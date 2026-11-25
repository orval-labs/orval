import { isObject, type OpenApiNonBooleanSchemaObject } from '@orval/core';

import { unsupportedOnly } from './logger';

// Keywords that constrain a value but have no valibot counterpart here.
const IGNORED_KEYWORDS = [
  'not',
  'if',
  'then',
  'else',
  'patternProperties',
  'propertyNames',
  'dependentRequired',
  'dependentSchemas',
  'dependencies',
  'unevaluatedProperties',
  'unevaluatedItems',
  'contains',
  'minContains',
  'maxContains',
  'uniqueItems',
  'minProperties',
  'maxProperties',
  'additionalItems',
  'contentSchema',
  '$dynamicRef',
] as const;

// Keywords that apply to a single type and need that type to be validated.
const TYPED_CONSTRAINTS = [
  'minimum',
  'maximum',
  'exclusiveMinimum',
  'exclusiveMaximum',
  'multipleOf',
  'minLength',
  'maxLength',
  'pattern',
  'minItems',
  'maxItems',
  'items',
] as const;

// Formats the generated schema checks on a string, by an action or as a file.
const CHECKED_FORMATS = new Set([
  'email',
  'uri',
  'uuid',
  'ipv4',
  'ipv6',
  'byte',
  'date',
  'date-time',
  'binary',
]);

// Formats checked only by the number type they sit on.
const NUMERIC_FORMATS = new Set(['int32', 'int64', 'float', 'double']);

const hasType = (type: unknown, names: readonly string[]): boolean => {
  const types: unknown[] = Array.isArray(type) ? type : [type];
  return types.some((item) => typeof item === 'string' && names.includes(item));
};

// Values that constrain nothing: `false`, `0`, `true` where it allows all, and
// an empty schema map.
const isNoOp = (key: string, value: unknown): boolean =>
  (key === 'uniqueItems' && value === false) ||
  ((key === 'minProperties' || key === 'minContains') && value === 0) ||
  ((key === 'unevaluatedProperties' ||
    key === 'unevaluatedItems' ||
    key === 'additionalItems' ||
    key === 'propertyNames') &&
    (value === true || (isObject(value) && Object.keys(value).length === 0))) ||
  ((key === 'patternProperties' ||
    key === 'dependentSchemas' ||
    key === 'dependentRequired' ||
    key === 'dependencies') &&
    isObject(value) &&
    Object.keys(value).length === 0);

/** Reports each keyword that the schema sets and valibot does not validate. */
export const reportIgnoredKeywords = (
  schema: OpenApiNonBooleanSchemaObject,
  path: string | undefined,
): void => {
  const record: Record<string, unknown> = schema;
  for (const key of IGNORED_KEYWORDS) {
    if (record[key] === undefined || isNoOp(key, record[key])) continue;
    unsupportedOnly(`\`${key}\` is not validated.`, path);
  }
};

/** Reports constraints that need a `type` the schema does not declare. */
export const reportUncheckedConstraints = (
  schema: OpenApiNonBooleanSchemaObject,
  path: string | undefined,
): void => {
  const record: Record<string, unknown> = schema;
  const keys = TYPED_CONSTRAINTS.filter((key) => record[key] !== undefined);
  if (keys.length > 0) {
    unsupportedOnly(
      `${keys.map((key) => `\`${key}\``).join(', ')} without a \`type\` is not validated.`,
      path,
    );
  }
};

/**
 * Reports a `format` the schema does not check. A format mapped by
 * `formatType`, or next to an `enum` or `const`, is left to them.
 */
export const reportUncheckedFormat = (
  schema: OpenApiNonBooleanSchemaObject,
  path: string | undefined,
  isMapped: boolean,
): void => {
  const { format } = schema;
  if (
    typeof format !== 'string' ||
    (CHECKED_FORMATS.has(format) && hasType(schema.type, ['string'])) ||
    (NUMERIC_FORMATS.has(format) &&
      hasType(schema.type, ['integer', 'number'])) ||
    isMapped ||
    schema.enum !== undefined ||
    schema.const !== undefined
  ) {
    return;
  }
  unsupportedOnly(`\`format: ${format}\` is not validated.`, path);
};

/** Reports a `contentEncoding` other than `base64`, the one valibot checks. */
export const reportUncheckedEncoding = (
  schema: OpenApiNonBooleanSchemaObject,
  path: string | undefined,
): void => {
  const encoding: unknown = schema.contentEncoding;
  if (
    typeof encoding !== 'string' ||
    encoding === 'base64' ||
    schema.enum !== undefined ||
    schema.const !== undefined
  ) {
    return;
  }
  unsupportedOnly(`\`contentEncoding: ${encoding}\` is not validated.`, path);
};
