import { toCamelCase, toSnakeCase } from './utils';

interface SchemaLike {
  type?: string | string[];
  format?: string;
  $ref?: string;
  items?: SchemaLike;
  anyOf?: SchemaLike[];
  oneOf?: SchemaLike[];
  allOf?: SchemaLike[];
  properties?: Record<string, SchemaLike>;
  additionalProperties?: boolean | SchemaLike;
  enum?: unknown[];
  const?: unknown;
  default?: unknown;
  required?: string[];
  title?: string;
  description?: string;
  minimum?: number;
  maximum?: number;
  exclusiveMinimum?: number;
  exclusiveMaximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

export type { SchemaLike };

export interface DartTypeResult {
  type: string;
  nullable: boolean;
  imports: string[];
  isDateTime: boolean;
  isDateOnly: boolean;
  isTimeOnly: boolean;
  isBinary: boolean;
  isList: boolean;
  listItemType?: DartTypeResult;
  isReference: boolean;
  referenceName?: string;
}

function makeResult(overrides: Partial<DartTypeResult> = {}): DartTypeResult {
  return {
    type: 'dynamic',
    nullable: false,
    imports: [],
    isDateTime: false,
    isDateOnly: false,
    isTimeOnly: false,
    isBinary: false,
    isList: false,
    isReference: false,
    ...overrides,
  };
}

function extractRefName(ref: string): string {
  return ref.split('/').pop() ?? ref;
}

/**
 * Resolve an OpenAPI schema to a Dart type descriptor.
 */
export function resolveDartType(schema: SchemaLike): DartTypeResult {
  if (!schema) return makeResult();

  // $ref
  if (schema.$ref) {
    const refName = extractRefName(schema.$ref);
    return makeResult({
      type: refName,
      isReference: true,
      referenceName: refName,
      imports: [toSnakeCase(refName)],
    });
  }

  // anyOf / oneOf – handle nullable pattern and mixed types
  const unionKey = schema.anyOf ? 'anyOf' : schema.oneOf ? 'oneOf' : null;
  if (unionKey) {
    const variants = schema[unionKey]!;
    const nonNull = variants.filter(
      (v) =>
        !(
          v.type === 'null' ||
          (Array.isArray(v.type) && v.type.includes('null'))
        ),
    );
    const hasNull = nonNull.length < variants.length;

    if (nonNull.length === 1) {
      const inner = resolveDartType(nonNull[0]);
      return { ...inner, nullable: hasNull || inner.nullable };
    }
    if (nonNull.length === 0) {
      return makeResult({ nullable: true });
    }
    // Multiple non-null types → dynamic
    return makeResult({ nullable: hasNull });
  }

  // allOf – merge properties, use first $ref as base
  if (schema.allOf) {
    const refSchema = schema.allOf.find((s) => s.$ref);
    if (refSchema) return resolveDartType(refSchema);
    return makeResult({ type: 'Map<String, dynamic>' });
  }

  // array
  if (schema.type === 'array' && schema.items) {
    const itemResult = resolveDartType(schema.items);
    return makeResult({
      type: `List<${itemResult.type}>`,
      isList: true,
      listItemType: itemResult,
      imports: itemResult.imports,
    });
  }

  // enum
  if (schema.enum) {
    return makeResult({ type: 'String' });
  }

  // primitives
  const typ = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  switch (typ) {
    case 'string':
      if (schema.format === 'date')
        return makeResult({ type: 'DateTime', isDateOnly: true });
      if (schema.format === 'date-time')
        return makeResult({ type: 'DateTime', isDateTime: true });
      if (schema.format === 'time')
        return makeResult({ type: 'String', isTimeOnly: true });
      if (schema.format === 'binary')
        return makeResult({ type: 'dynamic', isBinary: true });
      return makeResult({ type: 'String' });
    case 'integer':
      return makeResult({ type: 'int' });
    case 'number':
      return makeResult({ type: 'double' });
    case 'boolean':
      return makeResult({ type: 'bool' });
    case 'object':
      return makeResult({ type: 'Map<String, dynamic>' });
    case 'null':
      return makeResult({ nullable: true });
    default:
      return makeResult();
  }
}

export interface DartField {
  name: string;
  jsonName: string;
  dartType: string;
  fullType: string;
  isRequired: boolean;
  isNullable: boolean;
  defaultValue: string | undefined;
  typeResult: DartTypeResult;
}

/**
 * Resolve all properties of a schema into DartField descriptors.
 */
export function resolveSchemaFields(schema: SchemaLike): DartField[] {
  const properties = (schema.properties ?? {}) as Record<string, SchemaLike>;
  const requiredSet = new Set(schema.required ?? []);
  const fields: DartField[] = [];

  for (const [jsonName, propSchema] of Object.entries(properties)) {
    const typeResult = resolveDartType(propSchema);
    const isRequired = requiredSet.has(jsonName);
    const isNullable =
      typeResult.nullable || (!isRequired && !('default' in propSchema));

    const dartType = typeResult.type;
    const fullType =
      isNullable && dartType !== 'dynamic' ? `${dartType}?` : dartType;
    const name = escapeDartFieldName(toCamelCase(jsonName));

    let defaultValue: string | undefined;
    if (propSchema.default !== undefined) {
      defaultValue = dartLiteral(propSchema.default, typeResult);
    }

    fields.push({
      name,
      jsonName,
      dartType,
      fullType,
      isRequired: isRequired && defaultValue === undefined,
      isNullable,
      defaultValue,
      typeResult,
    });
  }
  return fields;
}

function escapeDartFieldName(name: string): string {
  const DART_RESERVED = new Set([
    'abstract',
    'as',
    'assert',
    'async',
    'await',
    'break',
    'case',
    'catch',
    'class',
    'const',
    'continue',
    'default',
    'do',
    'dynamic',
    'else',
    'enum',
    'export',
    'extends',
    'extension',
    'external',
    'factory',
    'false',
    'final',
    'finally',
    'for',
    'get',
    'if',
    'implements',
    'import',
    'in',
    'interface',
    'is',
    'late',
    'library',
    'mixin',
    'new',
    'null',
    'on',
    'operator',
    'part',
    'required',
    'rethrow',
    'return',
    'sealed',
    'set',
    'show',
    'static',
    'super',
    'switch',
    'sync',
    'this',
    'throw',
    'true',
    'try',
    'typedef',
    'var',
    'void',
    'when',
    'while',
    'with',
    'yield',
  ]);
  return DART_RESERVED.has(name) ? `${name}_` : name;
}

function dartLiteral(
  value: unknown,
  typeResult: DartTypeResult,
): string | undefined {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') {
    if (typeResult.isDateTime || typeResult.isDateOnly) return undefined;
    return `'${value.replace(/'/g, "\\'")}'`;
  }
  return undefined;
}

/**
 * Generate the fromJson expression for a field.
 */
export function fromJsonExpr(field: DartField): string {
  const accessor = `json['${field.jsonName}']`;
  return fromJsonForType(accessor, field.typeResult, field.isNullable);
}

function fromJsonForType(
  accessor: string,
  tr: DartTypeResult,
  nullable: boolean,
): string {
  if (tr.isReference) {
    if (nullable) {
      return `${accessor} != null ? ${tr.type}.fromJson(${accessor} as Map<String, dynamic>) : null`;
    }
    return `${tr.type}.fromJson(${accessor} as Map<String, dynamic>)`;
  }

  if (tr.isList && tr.listItemType) {
    const itemTr = tr.listItemType;
    let mapExpr: string;
    if (itemTr.isReference) {
      mapExpr = `(e) => ${itemTr.type}.fromJson(e as Map<String, dynamic>)`;
    } else if (itemTr.isDateTime || itemTr.isDateOnly) {
      mapExpr = `(e) => DateTime.parse(e as String)`;
    } else {
      mapExpr = `(e) => e as ${itemTr.type}`;
    }
    const cast = `(${accessor} as List<dynamic>).map(${mapExpr}).toList()`;
    if (nullable) return `${accessor} != null ? ${cast} : null`;
    return cast;
  }

  if (tr.isDateTime || tr.isDateOnly) {
    if (nullable)
      return `${accessor} != null ? DateTime.parse(${accessor} as String) : null`;
    return `DateTime.parse(${accessor} as String)`;
  }

  if (tr.type === 'Map<String, dynamic>') {
    if (nullable)
      return `${accessor} != null ? Map<String, dynamic>.from(${accessor} as Map) : null`;
    return `Map<String, dynamic>.from(${accessor} as Map)`;
  }

  if (tr.type === 'dynamic') return accessor;

  if (tr.type === 'double') {
    if (nullable)
      return `${accessor} != null ? (${accessor} as num).toDouble() : null`;
    return `(${accessor} as num).toDouble()`;
  }

  if (nullable) return `${accessor} as ${tr.type}?`;
  return `${accessor} as ${tr.type}`;
}

/**
 * Generate the toJson expression for a field.
 */
export function toJsonExpr(field: DartField): string {
  return toJsonForType(field.name, field.typeResult, field.isNullable);
}

function toJsonForType(
  accessor: string,
  tr: DartTypeResult,
  nullable: boolean,
): string {
  if (tr.isReference) {
    if (nullable) return `${accessor}?.toJson()`;
    return `${accessor}.toJson()`;
  }

  if (tr.isList && tr.listItemType) {
    const itemTr = tr.listItemType;
    if (itemTr.isReference) {
      const mapExpr = `(e) => e.toJson()`;
      if (nullable) return `${accessor}?.map(${mapExpr}).toList()`;
      return `${accessor}.map(${mapExpr}).toList()`;
    }
    if (itemTr.isDateTime || itemTr.isDateOnly) {
      const fmt = itemTr.isDateOnly
        ? `(e) => e.toIso8601String().split('T').first`
        : `(e) => e.toIso8601String()`;
      if (nullable) return `${accessor}?.map(${fmt}).toList()`;
      return `${accessor}.map(${fmt}).toList()`;
    }
    return accessor;
  }

  if (tr.isDateOnly) {
    if (nullable) return `${accessor}?.toIso8601String().split('T').first`;
    return `${accessor}.toIso8601String().split('T').first`;
  }

  if (tr.isDateTime) {
    if (nullable) return `${accessor}?.toIso8601String()`;
    return `${accessor}.toIso8601String()`;
  }

  return accessor;
}
