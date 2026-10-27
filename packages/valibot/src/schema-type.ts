import {
  isObject,
  type OpenApiNonBooleanSchemaObject,
  type OpenApiSchemaObject,
} from '@orval/core';

type SchemaType =
  | 'integer'
  | 'number'
  | 'string'
  | 'boolean'
  | 'object'
  | 'null'
  | 'array';

const SCHEMA_TYPES: ReadonlySet<unknown> = new Set<SchemaType>([
  'integer',
  'number',
  'string',
  'boolean',
  'object',
  'null',
  'array',
]);

const isSchemaType = (value: unknown): value is SchemaType =>
  SCHEMA_TYPES.has(value);

export const isNonBoolean = (
  schema: OpenApiSchemaObject | undefined,
): schema is OpenApiNonBooleanSchemaObject => isObject(schema);

// Types of a multi-type schema other than `null`, which is the nullable flag.
export const getMultiTypes = (
  schema: OpenApiNonBooleanSchemaObject,
): Exclude<SchemaType, 'null'>[] =>
  Array.isArray(schema.type)
    ? schema.type.filter(
        (t): t is Exclude<SchemaType, 'null'> =>
          t !== 'null' && isSchemaType(t),
      )
    : [];

export type ResolvedType = SchemaType | 'unknown';

export const resolveType = (
  schema: OpenApiNonBooleanSchemaObject,
): ResolvedType => {
  const { type } = schema;
  if (Array.isArray(type)) {
    const types = getMultiTypes(schema);
    if (types.length > 0) return types[0];
    return type.includes('null') ? 'null' : 'unknown';
  }
  return isSchemaType(type) ? type : 'unknown';
};

export const hasProperties = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  isObject(schema.properties) && Object.keys(schema.properties).length > 0;
