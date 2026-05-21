import nodePath from 'node:path';

import type { ClientFileBuilder } from '@orval/core';

import { resolveDartType, type SchemaLike } from './dart-types';
import { sanitizeTagName, toCamelCase, toSnakeCase } from './utils';

interface OpenApiSpec {
  paths?: Record<string, Record<string, OperationObject>>;
  components?: {
    schemas?: Record<string, SchemaLike>;
    securitySchemes?: Record<string, unknown>;
  };
  servers?: { url: string }[];
}

interface OperationObject {
  tags?: string[];
  summary?: string;
  operationId?: string;
  parameters?: ParameterObject[];
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: SchemaLike }>;
  };
  responses?: Record<string, ResponseObject>;
  security?: Record<string, string[]>[];
}

interface ParameterObject {
  name: string;
  in: string;
  required?: boolean;
  schema?: SchemaLike;
}

interface ResponseObject {
  description?: string;
  content?: Record<string, { schema?: SchemaLike }>;
}

interface OperationInfo {
  httpMethod: string;
  path: string;
  operationId: string;
  summary?: string;
  pathParams: ParameterObject[];
  queryParams: ParameterObject[];
  requestBodySchema: SchemaLike | undefined;
  requestBodyRequired: boolean;
  responseSchema: SchemaLike | undefined;
  requiresAuth: boolean;
  isMultipart: boolean;
}

/**
 * Generate Dart API client files grouped by tag.
 */
export function generateDartApiClients(
  spec: OpenApiSpec,
  apiDir: string,
  allSchemaNames: string[],
): ClientFileBuilder[] {
  const operations = extractOperations(spec);
  const grouped = groupByTag(operations);
  const files: ClientFileBuilder[] = [];

  for (const [tag, ops] of Object.entries(grouped)) {
    const className = sanitizeTagName(tag) + 'Api';
    const content = generateApiClass(className, ops, allSchemaNames);
    const fileName = toSnakeCase(className) + '.dart';
    files.push({
      path: nodePath.join(apiDir, fileName),
      content,
    });
  }

  files.push({
    path: nodePath.join(apiDir, 'api.dart'),
    content: generateApiBarrel(grouped),
  });

  return files;
}

function extractOperations(spec: OpenApiSpec): OperationInfo[] {
  const ops: OperationInfo[] = [];
  const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head'];

  for (const [pathStr, pathItem] of Object.entries(spec.paths ?? {})) {
    for (const method of httpMethods) {
      const operation = pathItem[method] as OperationObject | undefined;
      if (!operation) continue;

      const params = operation.parameters ?? [];
      const pathParams = params.filter((p) => p.in === 'path');
      const queryParams = params.filter((p) => p.in === 'query');

      let requestBodySchema: SchemaLike | undefined;
      let isMultipart = false;
      let requestBodyRequired = false;
      if (operation.requestBody?.content) {
        const contentTypes = Object.keys(operation.requestBody.content);
        if (contentTypes.includes('multipart/form-data')) {
          requestBodySchema =
            operation.requestBody.content['multipart/form-data'].schema;
          isMultipart = true;
        } else {
          const ct = contentTypes[0];
          requestBodySchema = operation.requestBody.content[ct]?.schema;
        }
        requestBodyRequired = operation.requestBody.required ?? false;
      }

      let responseSchema: SchemaLike | undefined;
      const successResp =
        operation.responses?.['200'] ?? operation.responses?.['201'];
      if (successResp?.content) {
        const ct = Object.keys(successResp.content)[0];
        responseSchema = successResp.content[ct]?.schema;
      }

      const requiresAuth = (operation.security ?? []).length > 0;

      ops.push({
        httpMethod: method,
        path: pathStr,
        operationId:
          operation.operationId ??
          `${method}_${pathStr.replace(/[^a-zA-Z0-9]/g, '_')}`,
        summary: operation.summary,
        pathParams,
        queryParams,
        requestBodySchema,
        requestBodyRequired,
        responseSchema,
        requiresAuth,
        isMultipart,
      });
    }
  }

  return ops;
}

function groupByTag(
  operations: OperationInfo[],
): Record<string, OperationInfo[]> {
  const spec_operations = operations.reduce(
    (acc, op) => {
      const tag =
        extractOperations.length > 0
          ? operations.find((o) => o === op)
            ? getTag(op)
            : 'Default'
          : 'Default';
      if (!acc[tag]) acc[tag] = [];
      acc[tag].push(op);
      return acc;
    },
    {} as Record<string, OperationInfo[]>,
  );
  return spec_operations;
}

function getTag(op: OperationInfo): string {
  // Derive tag from path: /api/{module}/... → module
  const parts = op.path.split('/').filter(Boolean);
  if (parts.length >= 2 && parts[0] === 'api') {
    return toCamelCase(parts[1]);
  }
  return 'default';
}

function generateApiClass(
  className: string,
  operations: OperationInfo[],
  allSchemaNames: string[],
): string {
  const allSchemaSet = new Set(allSchemaNames);
  const imports = new Set<string>();
  const usedNames = new Set<string>();

  const methods: string[] = [];
  for (const op of operations) {
    const { method, referencedSchemas } = generateMethod(
      op,
      allSchemaSet,
      usedNames,
    );
    methods.push(method);
    for (const s of referencedSchemas) imports.add(s);
  }

  let out = "import 'package:dio/dio.dart';\n\n";

  for (const imp of [...imports].sort()) {
    out += `import '../models/${imp}.dart';\n`;
  }
  if (imports.size > 0) out += '\n';

  out += `class ${className} {\n`;
  out += '  final Dio _dio;\n\n';
  out += `  ${className}(this._dio);\n`;

  for (const m of methods) {
    out += '\n' + m;
  }

  out += '}\n';
  return out;
}

/**
 * Derive a short, readable Dart method name from an operation.
 * Prefers the summary (e.g. "Send OTP") → sendOtp.
 * Falls back to a cleaned operationId.
 */
function deriveMethodName(op: OperationInfo): string {
  if (op.summary) {
    const words = op.summary
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .trim()
      .split(/\s+/);
    if (words.length > 0 && words[0]) {
      return toCamelCase(words.map((w) => w.toLowerCase()).join('_'));
    }
  }
  return toCamelCase(op.operationId.replace(/[^a-zA-Z0-9_]/g, '_'));
}

function generateMethod(
  op: OperationInfo,
  allSchemaSet: Set<string>,
  usedNames: Set<string>,
): { method: string; referencedSchemas: string[] } {
  const refs: string[] = [];
  let methodName = deriveMethodName(op);
  // Deduplicate within the same API class
  if (usedNames.has(methodName)) {
    methodName = `${methodName}${op.httpMethod.charAt(0).toUpperCase() + op.httpMethod.slice(1)}`;
  }
  usedNames.add(methodName);

  const params: string[] = [];
  const pathSubstitutions: Record<string, string> = {};

  // path params
  for (const p of op.pathParams) {
    const tr = resolveDartType(p.schema ?? { type: 'string' });
    const dartName = toCamelCase(p.name);
    params.push(`required ${tr.type} ${dartName}`);
    pathSubstitutions[p.name] = dartName;
  }

  // query params
  const queryParamNames: {
    jsonName: string;
    dartName: string;
    required: boolean;
    dartType: string;
  }[] = [];
  for (const p of op.queryParams) {
    const tr = resolveDartType(p.schema ?? { type: 'string' });
    const dartName = toCamelCase(p.name);
    const isRequired = p.required ?? false;
    const type = isRequired
      ? tr.type
      : tr.type === 'dynamic'
        ? 'dynamic'
        : `${tr.type}?`;
    params.push(`${isRequired ? 'required ' : ''}${type} ${dartName}`);
    queryParamNames.push({
      jsonName: p.name,
      dartName,
      required: isRequired,
      dartType: tr.type,
    });
  }

  // request body
  let bodyParamName: string | undefined;
  let bodyTypeName: string | undefined;
  if (op.requestBodySchema && !op.isMultipart) {
    const tr = resolveDartType(op.requestBodySchema);
    bodyTypeName = tr.type;
    if (tr.isReference && tr.referenceName) {
      refs.push(toSnakeCase(tr.referenceName));
    }
    bodyParamName = 'body';
    const req = op.requestBodyRequired ? 'required ' : '';
    const type = op.requestBodyRequired ? tr.type : `${tr.type}?`;
    params.push(`${req}${type} ${bodyParamName}`);
  }

  // multipart body
  if (op.isMultipart) {
    bodyParamName = 'formData';
    params.push('required FormData formData');
  }

  // response type (currently returns Response<dynamic>; refs not imported
  // to avoid unused-import warnings until typed deserialization is added)
  let responseType = 'dynamic';
  if (op.responseSchema) {
    const tr = resolveDartType(op.responseSchema);
    responseType = tr.type;
  }

  // check if response is empty schema
  const isEmptyResponse =
    !op.responseSchema ||
    (op.responseSchema &&
      !op.responseSchema.$ref &&
      !op.responseSchema.type &&
      !op.responseSchema.anyOf &&
      !op.responseSchema.oneOf &&
      !op.responseSchema.allOf);

  const returnType = isEmptyResponse
    ? 'Response<dynamic>'
    : `Response<dynamic>`;

  // build path with interpolation
  let dartPath = op.path;
  for (const [paramName, dartName] of Object.entries(pathSubstitutions)) {
    dartPath = dartPath.replace(`{${paramName}}`, `\$${dartName}`);
  }

  // build method
  let out = '';
  if (op.summary) {
    out += `  /// ${op.summary}\n`;
  }
  out += `  Future<${returnType}> ${methodName}(`;
  if (params.length > 0) {
    out += '{\n';
    for (const p of params) {
      out += `    ${p},\n`;
    }
    out += '  }';
  }
  out += ') async {\n';

  // query parameters map
  if (queryParamNames.length > 0) {
    out += '    final queryParameters = <String, dynamic>{\n';
    for (const q of queryParamNames) {
      if (q.required) {
        out += `      '${q.jsonName}': ${q.dartName},\n`;
      }
    }
    out += '    };\n';
    for (const q of queryParamNames) {
      if (!q.required) {
        out += `    if (${q.dartName} != null) {\n`;
        out += `      queryParameters['${q.jsonName}'] = ${q.dartName};\n`;
        out += '    }\n';
      }
    }
    out += '\n';
  }

  // dio call
  const dioMethod = op.httpMethod;
  out += `    final response = await _dio.${dioMethod}<dynamic>(\n`;
  out += `      '${dartPath}',\n`;
  if (bodyParamName && !op.isMultipart) {
    const isRef = op.requestBodySchema?.$ref;
    if (isRef) {
      out += `      data: ${bodyParamName}.toJson(),\n`;
    } else {
      out += `      data: ${bodyParamName},\n`;
    }
  }
  if (op.isMultipart) {
    out += `      data: ${bodyParamName},\n`;
  }
  if (queryParamNames.length > 0) {
    out += '      queryParameters: queryParameters,\n';
  }
  out += '    );\n';
  out += '    return response;\n';
  out += '  }\n';

  return { method: out, referencedSchemas: refs };
}

function generateApiBarrel(grouped: Record<string, OperationInfo[]>): string {
  return (
    Object.keys(grouped)
      .map((tag) => {
        const className = sanitizeTagName(tag) + 'Api';
        return `export '${toSnakeCase(className)}.dart';`;
      })
      .sort()
      .join('\n') + '\n'
  );
}
