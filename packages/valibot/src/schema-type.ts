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

export type CompositionKey = 'allOf' | 'oneOf' | 'anyOf';

const COMPOSITION_KEYS: readonly CompositionKey[] = ['allOf', 'oneOf', 'anyOf'];

// The composition keywords the schema uses, in a fixed order.
export const getCompositionKeys = (
  schema: OpenApiNonBooleanSchemaObject,
): CompositionKey[] =>
  COMPOSITION_KEYS.filter(
    (key) => Array.isArray(schema[key]) && schema[key].length > 0,
  );

// `default` and `description` belong to the outer schema only.
export const withoutOuterAnnotations = (
  schema: OpenApiNonBooleanSchemaObject,
): OpenApiNonBooleanSchemaObject => {
  const { default: _default, description: _description, ...rest } = schema;
  return rest;
};

const isListOf = (values: unknown, only: null | 'null'): boolean =>
  Array.isArray(values) &&
  values.length > 0 &&
  values.every((value) => value === only);

// `type: null`, or the OpenAPI 3.0 spelling `enum: [null]`.
const isNullMarker = (schema: OpenApiNonBooleanSchemaObject): boolean =>
  schema.type === 'null' ||
  isListOf(schema.type, 'null') ||
  (schema.type === undefined && isListOf(schema.enum, null));

/**
 * Swashbuckle writes a nullable `$ref` as `type: null` next to a composition,
 * which core reads as `T | null`. It is rewritten to the canonical
 * `anyOf: [composition, { type: null }]`.
 */
export const toCanonicalNullable = (
  schema: OpenApiNonBooleanSchemaObject,
): OpenApiNonBooleanSchemaObject => {
  if (
    !isNullMarker(schema) ||
    schema.const !== undefined ||
    getCompositionKeys(schema).length === 0
  ) {
    return schema;
  }
  const { type: _type, enum: _enum, ...value } = schema;
  return {
    ...(schema.description === undefined
      ? {}
      : { description: schema.description }),
    ...(schema.default === undefined ? {} : { default: schema.default }),
    anyOf: [withoutOuterAnnotations(value), { type: 'null' }],
  };
};
