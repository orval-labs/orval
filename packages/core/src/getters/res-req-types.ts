import { keyword } from 'esutils';
import { uniqueBy } from 'remeda';

import { resolveObject } from '../resolvers/object.ts';
import { resolveExampleRefs, resolveRef } from '../resolvers/ref.ts';
import {
  type ContextSpec,
  FormDataArrayHandling,
  type GeneratorImport,
  type GetterResponse,
  type OpenApiEncodingObject,
  type OpenApiMediaTypeObject,
  type OpenApiReferenceObject,
  type OpenApiRequestBodyObject,
  type OpenApiResponseObject,
  type OpenApiSchemaObject,
  type ResReqTypesValue,
} from '../types.ts';
import { isReference } from '../utils/assertion.ts';
import { pascal } from '../utils/case.ts';
import {
  getFormDataFieldFileType,
  isBinaryContentType,
} from '../utils/content-type.ts';
import { camel } from '../utils/index.ts';
import { getNumberWord } from '../utils/string.ts';
import type { FormDataContext } from './object.ts';

// Bridge assertion helpers for AnyOtherAttribute-infected schema properties.
// OpenAPI SchemaObject includes `[key: string]: any` which infects all property access.
// These helpers centralize the cast so it appears once rather than at each access site.
const getSchemaType = (s: OpenApiSchemaObject) =>
  s.type as string | string[] | undefined;
const getSchemaCombined = (s: OpenApiSchemaObject) =>
  (s.oneOf ?? s.anyOf ?? s.allOf) as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;
const getSchemaOneOf = (s: OpenApiSchemaObject) =>
  s.oneOf as (OpenApiSchemaObject | OpenApiReferenceObject)[] | undefined;
const getSchemaAnyOf = (s: OpenApiSchemaObject) =>
  s.anyOf as (OpenApiSchemaObject | OpenApiReferenceObject)[] | undefined;
const getSchemaItems = (s: OpenApiSchemaObject) =>
  s.items as OpenApiSchemaObject | OpenApiReferenceObject | undefined;
const getSchemaRequired = (s: OpenApiSchemaObject) =>
  s.required as string[] | undefined;
const getSchemaProperties = (s: OpenApiSchemaObject) =>
  s.properties as
    | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
    | undefined;

const formDataContentTypes = new Set(['multipart/form-data']);

const formUrlEncodedContentTypes = new Set([
  'application/x-www-form-urlencoded',
]);

interface GetResReqContentTypesOptions {
  mediaType: OpenApiMediaTypeObject;
  propName?: string;
  context: ContextSpec;
  isFormData?: boolean;
  contentType: string;
}

function getResReqContentTypes({
  mediaType,
  propName,
  context,
  isFormData,
  contentType,
}: GetResReqContentTypesOptions) {
  if (!mediaType.schema) {
    return;
  }

  // For form-data, pass context that tracks encoding for file type detection
  const formDataContext: FormDataContext | undefined = isFormData
    ? { atPart: false, encoding: mediaType.encoding ?? {} }
    : undefined;

  const resolvedObject = resolveObject({
    schema: mediaType.schema,
    propName,
    context,
    formDataContext,
  });

  // Media key has highest precedence: binary media key → Blob (overrides schema)
  if (!isFormData && isBinaryContentType(contentType)) {
    return {
      ...resolvedObject,
      value: 'Blob',
    };
  }

  return resolvedObject;
}

export function getResReqTypes(
  responsesOrRequests: [
    string,
    OpenApiReferenceObject | OpenApiResponseObject | OpenApiRequestBodyObject,
  ][],
  name: string,
  context: ContextSpec,
  defaultType = 'unknown',
  uniqueKey: (
    item: ResReqTypesValue,
    index: number,
    data: ResReqTypesValue[],
  ) => unknown = (item) => item.value,
): ResReqTypesValue[] {
  const typesArray = responsesOrRequests
    .filter(([, res]) => Boolean(res))
    .map(([key, res]) => {
      if (isReference(res)) {
        const {
          schema: bodySchema,
          imports: [{ name, schemaName }],
        } = resolveRef<OpenApiRequestBodyObject | OpenApiResponseObject>(
          res,
          context,
        );

        const firstEntry = Object.entries(bodySchema.content ?? {}).at(0);

        if (!firstEntry) {
          return [
            {
              value: name,
              imports: [{ name, schemaName }],
              schemas: [],
              type: 'unknown',
              isEnum: false,
              isRef: true,
              hasReadonlyProps: false,
              originalSchema: undefined,
              example: undefined,
              examples: undefined,
              key,
              contentType: undefined,
            },
          ] as ResReqTypesValue[];
        }

        const [contentType, mediaType] = firstEntry;

        const isFormData = formDataContentTypes.has(contentType);
        const isFormUrlEncoded = formUrlEncodedContentTypes.has(contentType);

        if ((!isFormData && !isFormUrlEncoded) || !mediaType.schema) {
          return [
            {
              value: name,
              imports: [{ name, schemaName }],
              schemas: [],
              type: 'unknown',
              isEnum: false,
              isRef: true,
              hasReadonlyProps: false,
              originalSchema: mediaType.schema,
              example: mediaType.example as unknown,
              examples: resolveExampleRefs(
                mediaType.examples as
                  | Record<string, OpenApiReferenceObject | { value?: unknown }>
                  | undefined,
                context,
              ),
              key,
              contentType,
            },
          ] as ResReqTypesValue[];
        }

        const formData = isFormData
          ? getSchemaFormDataAndUrlEncoded({
              name,
              schemaObject: mediaType.schema,
              context,
              isRequestBodyOptional:
                // Even though required is false by default, we only consider required to be false if specified. (See pull 1277)
                'required' in bodySchema && bodySchema.required === false,
              isRef: true,
              encoding: mediaType.encoding,
            })
          : undefined;

        const formUrlEncoded = isFormUrlEncoded
          ? getSchemaFormDataAndUrlEncoded({
              name,
              schemaObject: mediaType.schema,
              context,
              isRequestBodyOptional:
                'required' in bodySchema && bodySchema.required === false,
              isUrlEncoded: true,
              isRef: true,
              encoding: mediaType.encoding,
            })
          : undefined;

        const additionalImports = getFormDataAdditionalImports({
          schemaObject: mediaType.schema,
          context,
        });

        return [
          {
            value: name,
            imports: [{ name, schemaName }, ...additionalImports],
            schemas: [],
            type: 'unknown',
            isEnum: false,
            hasReadonlyProps: false,
            formData,
            formUrlEncoded,
            isRef: true,
            originalSchema: mediaType.schema,
            example: mediaType.example,
            examples: resolveExampleRefs(mediaType.examples, context),
            key,
            contentType,
          },
        ] as ResReqTypesValue[];
      }

      if (res.content) {
        const contents = Object.entries(res.content).map(
          ([contentType, mediaType], index, arr) => {
            let propName = key ? pascal(name) + pascal(key) : undefined;

            if (propName && arr.length > 1) {
              propName = propName + pascal(getNumberWord(index + 1));
            }

            // When schema is a $ref, use schema name for consistent param naming
            let effectivePropName = propName;
            if (mediaType.schema && isReference(mediaType.schema)) {
              const { imports } = resolveRef<OpenApiSchemaObject>(
                mediaType.schema,
                context,
              );
              if (imports[0]?.name) {
                effectivePropName = imports[0].name;
              }
            }

            const isFormData = formDataContentTypes.has(contentType);

            const resolvedValue = getResReqContentTypes({
              mediaType,
              propName: effectivePropName,
              context,
              isFormData,
              contentType,
            });

            if (!resolvedValue) {
              // openapi spec 3.1 allows describing binary responses with only a content type
              if (isBinaryContentType(contentType)) {
                return {
                  value: 'Blob',
                  imports: [],
                  schemas: [],
                  type: 'Blob',
                  isEnum: false,
                  key,
                  isRef: false,
                  hasReadonlyProps: false,
                  contentType,
                };
              }

              return;
            }

            const isFormUrlEncoded =
              formUrlEncodedContentTypes.has(contentType);

            if (
              (!isFormData && !isFormUrlEncoded) ||
              !effectivePropName ||
              !mediaType.schema
            ) {
              return {
                ...resolvedValue,
                imports: resolvedValue.imports,
                contentType,
                example: mediaType.example,
                examples: resolveExampleRefs(mediaType.examples, context),
              };
            }

            const formData = isFormData
              ? getSchemaFormDataAndUrlEncoded({
                  name: effectivePropName,
                  schemaObject: mediaType.schema,
                  context,
                  isRequestBodyOptional:
                    'required' in res && res.required === false,
                  isRef: true,
                  encoding: mediaType.encoding,
                })
              : undefined;

            const formUrlEncoded = isFormUrlEncoded
              ? getSchemaFormDataAndUrlEncoded({
                  name: effectivePropName,
                  schemaObject: mediaType.schema,
                  context,
                  isUrlEncoded: true,
                  isRequestBodyOptional:
                    'required' in res && res.required === false,
                  isRef: true,
                  encoding: mediaType.encoding,
                })
              : undefined;

            const additionalImports = getFormDataAdditionalImports({
              schemaObject: mediaType.schema,
              context,
            });
            return {
              ...resolvedValue,
              imports: [...resolvedValue.imports, ...additionalImports],
              formData,
              formUrlEncoded,
              contentType,
              example: mediaType.example as unknown,
              examples: resolveExampleRefs(
                mediaType.examples as
                  | Record<string, OpenApiReferenceObject | { value?: unknown }>
                  | undefined,
                context,
              ),
            };
          },
        );

        return contents
          .filter(Boolean)
          .map((x) => ({ ...x, key })) as ResReqTypesValue[];
      }
      const swaggerSchema =
        'schema' in res
          ? (
              res as {
                schema?: OpenApiSchemaObject | OpenApiReferenceObject;
              }
            ).schema
          : undefined;

      if (swaggerSchema) {
        const propName = key ? pascal(name) + pascal(key) : undefined;
        const resolvedValue = resolveObject({
          schema: swaggerSchema,
          propName,
          context,
        });

        return [
          {
            ...resolvedValue,
            contentType: 'application/json',
            key,
          },
        ] as ResReqTypesValue[];
      }

      return [
        {
          value: defaultType,
          imports: [],
          schemas: [],
          type: defaultType,
          isEnum: false,
          key,
          isRef: false,
          hasReadonlyProps: false,
          contentType: 'application/json',
        },
      ] as ResReqTypesValue[];
    });

  return uniqueBy(typesArray.flat(), uniqueKey);
}

/**
 * Response type categories for HTTP client response parsing.
 * Maps to Angular HttpClient's responseType, Axios responseType, and Fetch response methods.
 */
export type ResponseTypeCategory = 'json' | 'text' | 'blob' | 'arraybuffer';

/**
 * Determine the responseType option based on success content types only.
 * This avoids error-response content types influencing the responseType.
 */
export function getSuccessResponseType(
  response: GetterResponse,
): 'blob' | 'text' | undefined {
  const successContentTypes = response.types.success
    .map((t) => t.contentType)
    .filter(Boolean) as string[];

  if (response.isBlob) {
    return 'blob' as const;
  }

  const hasJsonResponse = successContentTypes.some(
    (contentType) =>
      contentType.includes('json') || contentType.includes('+json'),
  );
  const hasTextResponse = successContentTypes.some(
    (contentType) =>
      contentType.startsWith('text/') || contentType.includes('xml'),
  );

  if (!hasJsonResponse && hasTextResponse) {
    return 'text' as const;
  }

  return undefined;
}

/**
 * Determine the response type category for a given content type.
 * Used to set the correct responseType option in HTTP clients.
 *
 * @param contentType - The MIME content type (e.g., 'application/json', 'text/plain')
 * @returns The response type category to use for parsing
 */
export function getResponseTypeCategory(
  contentType: string,
): ResponseTypeCategory {
  // Binary types → blob
  if (isBinaryContentType(contentType)) {
    return 'blob';
  }

  // JSON types
  if (
    contentType === 'application/json' ||
    contentType.includes('+json') ||
    contentType.includes('-json')
  ) {
    return 'json';
  }

  // Everything else is text (text/*, application/xml, etc.)
  return 'text';
}

/**
 * Get the default content type from a list of content types.
 * Priority: application/json > any JSON-like type > first in list
 *
 * @param contentTypes - Array of content types from OpenAPI spec
 * @returns The default content type to use
 */
export function getDefaultContentType(contentTypes: string[]): string {
  if (contentTypes.length === 0) {
    return 'application/json';
  }

  // Prefer application/json
  if (contentTypes.includes('application/json')) {
    return 'application/json';
  }

  // Prefer any JSON-like type
  const jsonType = contentTypes.find(
    (ct) => ct.includes('+json') || ct.includes('-json'),
  );
  if (jsonType) {
    return jsonType;
  }

  // Default to first
  return contentTypes[0];
}

interface GetFormDataAdditionalImportsOptions {
  schemaObject: OpenApiSchemaObject | OpenApiReferenceObject;
  context: ContextSpec;
}

function getFormDataAdditionalImports({
  schemaObject,
  context,
}: GetFormDataAdditionalImportsOptions): GeneratorImport[] {
  const { schema } = resolveRef<OpenApiSchemaObject>(schemaObject, context);

  if (schema.type !== 'object') {
    return [];
  }

  const combinedSchemas = getSchemaOneOf(schema) ?? getSchemaAnyOf(schema);

  if (!combinedSchemas) {
    return [];
  }

  return combinedSchemas
    .map(
      (subSchema) =>
        resolveRef<OpenApiSchemaObject>(subSchema, context).imports[0],
    )
    .filter(Boolean);
}

interface GetSchemaFormDataAndUrlEncodedOptions {
  name: string;
  schemaObject: OpenApiSchemaObject | OpenApiReferenceObject;
  context: ContextSpec;
  isRequestBodyOptional: boolean;
  isUrlEncoded?: boolean;
  isRef?: boolean;
  encoding?: Record<string, OpenApiEncodingObject>;
}

function getSchemaFormDataAndUrlEncoded({
  name,
  schemaObject,
  context,
  isRequestBodyOptional,
  isUrlEncoded,
  isRef,
  encoding,
}: GetSchemaFormDataAndUrlEncodedOptions): string {
  const { schema, imports } = resolveRef<OpenApiSchemaObject>(
    schemaObject,
    context,
  );
  const propName = camel(
    !isRef && isReference(schemaObject) ? imports[0].name : name,
  );
  const additionalImports: GeneratorImport[] = [];

  const variableName = isUrlEncoded ? 'formUrlEncoded' : 'formData';
  let form = isUrlEncoded
    ? `const ${variableName} = new URLSearchParams();\n`
    : `const ${variableName} = new FormData();\n`;

  const combinedSchemas = getSchemaCombined(schema);
  if (
    schema.type === 'object' ||
    (schema.type === undefined && combinedSchemas)
  ) {
    if (combinedSchemas) {
      const shouldCast = !!getSchemaOneOf(schema) || !!getSchemaAnyOf(schema);

      const combinedSchemasFormData = combinedSchemas
        .map((subSchema) => {
          const { schema: combinedSchema, imports } =
            resolveRef<OpenApiSchemaObject>(subSchema, context);

          let newPropName = propName;
          let newPropDefinition = '';

          // If the schema is a union type (oneOf, anyOf) and includes a reference (has imports),
          // we need to cast the property to the specific type to avoid TypeScript errors.
          if (shouldCast && imports[0]) {
            additionalImports.push(imports[0]);
            newPropName = `${propName}${pascal(imports[0].name)}`;
            newPropDefinition = `const ${newPropName} = (${propName} as ${imports[0].name}${isRequestBodyOptional ? ' | undefined' : ''});\n`;
          }

          return (
            newPropDefinition +
            resolveSchemaPropertiesToFormData({
              schema: combinedSchema,
              variableName,
              propName: newPropName,
              context,
              isRequestBodyOptional,
              encoding,
            })
          );
        })
        .filter(Boolean)
        .join('\n');

      form += combinedSchemasFormData;
    }

    if (schema.properties) {
      const formDataValues = resolveSchemaPropertiesToFormData({
        schema,
        variableName,
        propName,
        context,
        isRequestBodyOptional,
        encoding,
      });

      form += formDataValues;
    }

    return form;
  }

  if (schema.type === 'array') {
    let valueStr = 'value';
    const schemaItems = getSchemaItems(schema);
    if (schemaItems) {
      const { schema: itemSchema } = resolveRef<OpenApiSchemaObject>(
        schemaItems,
        context,
      );
      if (itemSchema.type === 'object' || itemSchema.type === 'array') {
        valueStr = 'JSON.stringify(value)';
      } else if (
        itemSchema.type === 'number' ||
        itemSchema.type === 'integer' ||
        itemSchema.type === 'boolean'
      ) {
        valueStr = 'value.toString()';
      }
    }

    return `${form}${propName}.forEach(value => ${variableName}.append('data', ${valueStr}))\n`;
  }

  if (
    schema.type === 'number' ||
    schema.type === 'integer' ||
    schema.type === 'boolean'
  ) {
    return `${form}${variableName}.append('data', ${propName}.toString())\n`;
  }

  return `${form}${variableName}.append('data', ${propName})\n`;
}

interface ResolveSchemaPropertiesToFormDataOptions {
  schema: OpenApiSchemaObject;
  variableName: string;
  propName: string;
  context: ContextSpec;
  isRequestBodyOptional: boolean;
  keyPrefix?: string;
  depth?: number;
  encoding?: Record<string, OpenApiEncodingObject>;
}

function resolveSchemaPropertiesToFormData({
  schema,
  variableName,
  propName,
  context,
  isRequestBodyOptional,
  keyPrefix = '',
  depth = 0,
  encoding,
}: ResolveSchemaPropertiesToFormDataOptions): string {
  let formDataValues = '';
  const schemaProps = getSchemaProperties(schema) ?? {};
  for (const [key, value] of Object.entries(schemaProps)) {
    const { schema: property } = resolveRef<OpenApiSchemaObject>(
      value,
      context,
    );

    // Skip readOnly properties for formData
    if (property.readOnly) {
      continue;
    }

    let formDataValue = '';

    // Get encoding.contentType for this field (only at top level, depth === 0)
    const fieldEncoding = depth === 0 ? encoding?.[key] : undefined;
    const partContentType = fieldEncoding?.contentType;

    const formattedKeyPrefix = isRequestBodyOptional
      ? keyword.isIdentifierNameES5(key)
        ? '?'
        : '?.'
      : '';
    const formattedKey = keyword.isIdentifierNameES5(key)
      ? `.${key}`
      : `['${key}']`;

    const valueKey = `${propName}${formattedKeyPrefix}${formattedKey}`;
    const nonOptionalValueKey = `${propName}${formattedKey}`;

    // Use shared file type detection (same logic as type generation)
    const fileType = getFormDataFieldFileType(property, partContentType);
    const effectiveContentType =
      partContentType ?? (property.contentMediaType as string | undefined);

    if (fileType === 'binary' || property.format === 'binary') {
      // Binary: append directly (value is Blob)
      formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey});\n`;
    } else if (fileType === 'text') {
      // Text file: value is Blob | string, check at runtime
      formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey} instanceof Blob ? ${nonOptionalValueKey} : new Blob([${nonOptionalValueKey}], { type: '${effectiveContentType}' }));\n`;
    } else if (property.type === 'object') {
      formDataValue =
        context.output.override.formData.arrayHandling ===
        FormDataArrayHandling.EXPLODE
          ? resolveSchemaPropertiesToFormData({
              schema: property,
              variableName,
              propName: nonOptionalValueKey,
              context,
              isRequestBodyOptional,
              keyPrefix: `${keyPrefix}${key}.`,
              depth: depth + 1,
              encoding,
            })
          : partContentType
            ? `${variableName}.append(\`${keyPrefix}${key}\`, new Blob([JSON.stringify(${nonOptionalValueKey})], { type: '${partContentType}' }));\n`
            : `${variableName}.append(\`${keyPrefix}${key}\`, JSON.stringify(${nonOptionalValueKey}));\n`;
    } else if (property.type === 'array') {
      let valueStr = 'value';
      let hasNonPrimitiveChild = false;
      const propertyItems = getSchemaItems(property);
      if (propertyItems) {
        const { schema: itemSchema } = resolveRef<OpenApiSchemaObject>(
          propertyItems,
          context,
        );
        if (itemSchema.type === 'object' || itemSchema.type === 'array') {
          if (
            context.output.override.formData.arrayHandling ===
            FormDataArrayHandling.EXPLODE
          ) {
            hasNonPrimitiveChild = true;
            const resolvedValue = resolveSchemaPropertiesToFormData({
              schema: itemSchema,
              variableName,
              propName: 'value',
              context,
              isRequestBodyOptional,
              keyPrefix: `${keyPrefix}${key}[\${index${depth > 0 ? depth : ''}}].`,
              depth: depth + 1,
            });
            formDataValue = `${valueKey}.forEach((value, index${depth > 0 ? depth : ''}) => {
    ${resolvedValue}});\n`;
          } else {
            valueStr = 'JSON.stringify(value)';
          }
        } else {
          const itemType = getSchemaType(itemSchema);
          if (
            itemType === 'number' ||
            (Array.isArray(itemType) && itemType.includes('number')) ||
            itemType === 'integer' ||
            (Array.isArray(itemType) && itemType.includes('integer')) ||
            itemType === 'boolean' ||
            (Array.isArray(itemType) && itemType.includes('boolean'))
          ) {
            valueStr = 'value.toString()';
          }
        }
      }
      if (
        context.output.override.formData.arrayHandling ===
        FormDataArrayHandling.EXPLODE
      ) {
        if (!hasNonPrimitiveChild) {
          formDataValue = `${valueKey}.forEach((value, index${depth > 0 ? depth : ''}) => ${variableName}.append(\`${keyPrefix}${key}[\${index${depth > 0 ? depth : ''}}]\`, ${valueStr}));\n`;
        }
      } else {
        formDataValue = `${valueKey}.forEach(value => ${variableName}.append(\`${keyPrefix}${key}${context.output.override.formData.arrayHandling === FormDataArrayHandling.SERIALIZE_WITH_BRACKETS ? '[]' : ''}\`, ${valueStr}));\n`;
      }
    } else if (
      (() => {
        const propType = getSchemaType(property);
        return (
          propType === 'number' ||
          (Array.isArray(propType) && propType.includes('number')) ||
          propType === 'integer' ||
          (Array.isArray(propType) && propType.includes('integer')) ||
          propType === 'boolean' ||
          (Array.isArray(propType) && propType.includes('boolean'))
        );
      })()
    ) {
      formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey}.toString())\n`;
    } else {
      formDataValue = `${variableName}.append(\`${keyPrefix}${key}\`, ${nonOptionalValueKey});\n`;
    }

    let existSubSchemaNullable = false;
    const combine = getSchemaCombined(property);
    if (combine) {
      const subSchemas = combine.map((c) =>
        resolveObject({ schema: c, combined: true, context: context }),
      );
      if (
        subSchemas.some((subSchema) => {
          return ['number', 'integer', 'boolean'].includes(subSchema.type);
        })
      ) {
        formDataValue = `${variableName}.append(\`${key}\`, ${nonOptionalValueKey}.toString())\n`;
      }

      if (
        subSchemas.some((subSchema) => {
          return subSchema.type === 'null';
        })
      ) {
        existSubSchemaNullable = true;
      }
    }

    const schemaRequired = getSchemaRequired(schema);
    const isRequired = schemaRequired?.includes(key) && !isRequestBodyOptional;

    const propType = getSchemaType(property);
    if (
      property.nullable ||
      (Array.isArray(propType) && propType.includes('null')) ||
      existSubSchemaNullable
    ) {
      if (isRequired) {
        formDataValues += `if(${valueKey} !== null) {\n ${formDataValue} }\n`;
        continue;
      }

      formDataValues += `if(${valueKey} !== undefined && ${nonOptionalValueKey} !== null) {\n ${formDataValue} }\n`;
      continue;
    }

    if (isRequired) {
      formDataValues += formDataValue;
      continue;
    }

    formDataValues += `if(${valueKey} !== undefined) {\n ${formDataValue} }\n`;
  }

  return formDataValues;
}
