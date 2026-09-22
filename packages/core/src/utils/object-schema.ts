import {
  isBooleanJsonSchema,
  isDereferenced,
} from '@scalar/openapi-types/helpers';

import type {
  OpenApiNonBooleanSchemaObject,
  OpenApiSchemaObject,
} from '../types';

/**
 * True for an inline value, including JSON Schema booleans (`true` / `false`).
 *
 * `isDereferenced` is false for booleans because they are not objects, so
 * `!isDereferenced(true)` looks like a `$ref`. A boolean schema is inline:
 * `true` admits every instance and `false` admits none.
 */
export function isInlineSchema<T>(
  value: T,
): value is [Exclude<T, { $ref: string }>] extends [never]
  ? T & { $ref?: undefined }
  : Exclude<T, { $ref: string }> {
  return isBooleanJsonSchema(value) || isDereferenced(value);
}

/**
 * JSON Schema boolean schemas as objects: `true` ≡ `{}`, `false` ≡ `{ not: {} }`.
 */
export function toObjectSchema(
  schema: OpenApiSchemaObject,
): OpenApiNonBooleanSchemaObject {
  if (!isBooleanJsonSchema(schema)) {
    return schema;
  }
  return schema ? {} : { not: {} };
}
