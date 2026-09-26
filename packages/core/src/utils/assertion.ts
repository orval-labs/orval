import path from 'node:path';

import {
  isBooleanJsonSchema,
  isMultiTypeSchema,
  isNullSchema,
  isStringSchema,
  isUntypedSchema,
} from '@scalar/openapi-types/helpers';

import {
  type ClientMockBuilder,
  type GlobalMockOptions,
  type MswMockOptions,
  type OpenApiSchemaObject,
  OutputMockType,
  SchemaType,
  Verbs,
} from '../types';
import { isInlineSchema } from './object-schema';

/**
 * Represents an OpenAPI 3.1 schema object that contains a `$dynamicRef`
 * keyword, used for recursive or polymorphic schema references.
 *
 * @see https://json-schema.org/draft/2020-12/json-schema-core#section-8.2.4
 */
export interface OpenApiDynamicReferenceObject {
  $dynamicRef: string;
  [key: string]: unknown;
}

/**
 * Discriminator helper for {@link OpenApiDynamicReferenceObject}.
 *
 * Returns `true` when `obj` has a `$dynamicRef` string property,
 * indicating it is an OpenAPI 3.1 dynamic reference rather than a
 * static `$ref`.
 *
 * @param obj - Value to test.
 *
 * @see https://json-schema.org/draft/2020-12/json-schema-core#section-8.2.4
 */
export function isDynamicReference(
  obj: object,
): obj is OpenApiDynamicReferenceObject {
  return (
    !isNullish(obj) &&
    Object.hasOwn(obj, '$dynamicRef') &&
    typeof (obj as Record<string, unknown>).$dynamicRef === 'string'
  );
}

/**
 * Returns `true` when `pathValue` has no file extension and is treated as a
 * directory path.
 *
 * @param pathValue - Path string to inspect.
 */
export function isDirectory(pathValue: string) {
  return !path.extname(pathValue);
}

/**
 * Type guard for plain objects created with `{}` or `new Object()`.
 *
 * Excludes `null`, arrays, dates, and other non-plain object values.
 *
 * @param x - Value to test.
 */
export function isObject(x: unknown): x is Record<string, unknown> {
  return Object.prototype.toString.call(x) === '[object Object]';
}

/**
 * Type guard for ES module namespace objects.
 *
 * @param x - Value to test.
 */
export function isModule(x: unknown): x is Record<string, unknown> {
  return Object.prototype.toString.call(x) === '[object Module]';
}

/**
 * Type guard for integer numbers and numeric strings.
 *
 * Accepts finite integers (`42`) and strings that match `/^-?\d+$/`
 * (`"-1"`, `"0"`). Rejects floats, empty strings, and non-numeric values.
 *
 * @param x - Value to test.
 */
export function isNumeric(x: unknown): x is number {
  if (typeof x === 'number') return Number.isInteger(x);
  return isString(x) && /^-?\d+$/.test(x);
}

/**
 * Type guard for an inline OpenAPI {@link OpenApiSchemaObject}.
 *
 * Returns `true` when `x` looks like a schema definition: it has a known
 * `type`, composition keywords (`allOf`, `anyOf`, `oneOf`), or `properties`.
 * Does not match reference objects (`$ref`). {@link isInlineSchema} is true
 * for inline schemas, including JSON Schema booleans, and false for references.
 *
 * @param x - Value to test.
 */
export function isSchema(x: unknown): x is OpenApiSchemaObject {
  if (!isObject(x)) {
    return false;
  }

  if (isString(x.type) && Object.values(SchemaType).includes(x.type)) {
    return true;
  }

  const combine = x.allOf ?? x.anyOf ?? x.oneOf;
  if (Array.isArray(combine)) {
    return true;
  }

  if (isObject(x.properties)) {
    return true;
  }

  return false;
}

/**
 * Whether a schema is dispatched as a string by {@link getScalar}.
 *
 * True for a bare `type: 'string'` and for the OAS 3.1 nullable union
 * `['string', 'null']`, which is what `resolveSpec` produces from a 3.0
 * `{ type: 'string', nullable: true }`. A union that also admits some other
 * type is not string-like: `getScalar` renders it as a union rather than
 * through `case 'string'`, so the string-only treatments (file parts, binary
 * coercion) must not claim it.
 *
 * @param schema - Schema to test.
 */
export function isStringLikeSchema(schema: OpenApiSchemaObject): boolean {
  if (isStringSchema(schema)) {
    return true;
  }

  return (
    isMultiTypeSchema(schema) &&
    schema.type.includes('string') &&
    schema.type.every((member) => member === 'string' || member === 'null')
  );
}

/**
 * Whether a schema accepts `null`.
 *
 * Nullability can sit on the schema itself (`type: 'null'` or
 * `type: ['string', 'null']`), on a `null` member of
 * an `enum`, or in a separate `{ type: 'null' }` branch of a `oneOf`/`anyOf`,
 * which is the spelling pydantic and other 3.1 generators emit for an optional
 * field.
 *
 * References are not resolved here, so a `$ref` branch never counts as
 * nullable on its own.
 *
 * @param schema - Schema to test.
 */
export function isSchemaNullable(schema: OpenApiSchemaObject): boolean {
  // `true` admits every instance, including null. `false` admits none.
  if (isBooleanJsonSchema(schema)) {
    return schema;
  }

  if (isNullSchema(schema)) {
    return true;
  }

  if (isMultiTypeSchema(schema) && schema.type.includes('null')) {
    return true;
  }

  // With no `type` at all, a `null` member of the `enum` is the whole constraint
  // on nullability — and the only spelling available for that case
  // (`{ enum: ['foo', null] }`). The member itself is never emitted into the
  // generated const; it only contributes the ` | null`.
  //
  // A sibling `type` settles the question on its own, so this deliberately does
  // not look at the enum when one is present. `type` and `enum` are independent
  // assertions combined with AND: a `type` that admits null has already
  // returned above, and one that does not makes the enum's `null` unreachable,
  // so honoring it would emit a `| null` the schema rejects.
  if (
    isUntypedSchema(schema) &&
    Array.isArray(schema.enum) &&
    schema.enum.includes(null) &&
    !someAllOfBranchRejectsNull(schema.allOf)
  ) {
    return true;
  }

  const variants = [
    ...(Array.isArray(schema.oneOf) ? schema.oneOf : []),
    ...(Array.isArray(schema.anyOf) ? schema.anyOf : []),
  ] as unknown[];

  return variants.some((variant) => {
    if (!isObject(variant) || !isInlineSchema(variant)) {
      return false;
    }

    return isSchemaNullable(variant as OpenApiSchemaObject);
  });
}

/**
 * Whether the schema's `enum` admits only `null` — the OAS 3.0 spelling of a
 * null branch (`anyOf: [{ $ref }, { enum: [null] }]`), whatever its `type`.
 */
export function isNullOnlyEnum(schema: unknown): boolean {
  if (!isObject(schema)) return false;
  const schemaEnum = schema.enum;
  return (
    Array.isArray(schemaEnum) &&
    schemaEnum.length > 0 &&
    schemaEnum.every((member) => member === null)
  );
}

/**
 * Whether any member of an `allOf` rules `null` out.
 *
 * `allOf` is an intersection, so one branch refusing null is enough to make an
 * enclosing enum's `null` member unreachable:
 * `{ enum: ['a', null], allOf: [{ type: 'string' }] }` admits only `'a'`.
 *
 * Only a branch that *definitely* rejects null counts. A branch constraining
 * nothing permits it, and a `$ref` is not resolved here, so neither is read as
 * rejecting — erring toward a `| null` that was not strictly needed rather than
 * dropping one the API can really return.
 *
 * @param allOf - Value of the enclosing schema's `allOf`, if it has one.
 */
function someAllOfBranchRejectsNull(allOf: unknown): boolean {
  if (!Array.isArray(allOf)) {
    return false;
  }

  return allOf.some((branch) => {
    if (!isObject(branch) || !isInlineSchema(branch)) {
      return false;
    }

    const { type, enum: members } = branch as Exclude<
      OpenApiSchemaObject,
      boolean
    >;

    if (type !== undefined) {
      const admitsNull = Array.isArray(type)
        ? type.includes('null')
        : type === 'null';
      if (!admitsNull) {
        return true;
      }
    }

    return Array.isArray(members) && !members.includes(null);
  });
}

/**
 * Type guard for HTTP methods defined in {@link Verbs}.
 *
 * @param verb - Method name to test (for example, `"get"`, `"post"`).
 */
export function isVerb(verb: string): verb is Verbs {
  return Object.values(Verbs).includes(verb as Verbs);
}

/**
 * Returns `true` when `str` is a valid absolute URL with an `http:` or
 * `https:` protocol.
 *
 * Empty or whitespace-only strings are rejected.
 *
 * @param str - URL string to validate.
 */
export function isUrl(str: string) {
  if (!str.trim()) return false;

  try {
    const url = new URL(str);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Type guard for the MSW mock generator. Use to narrow a
 * `GlobalMockOptions | ClientMockBuilder` value to `MswMockOptions`.
 *
 * @param mock - Mock configuration or builder to test.
 */
export function isMswMock(
  mock: GlobalMockOptions | ClientMockBuilder,
): mock is MswMockOptions {
  return !isFunction(mock) && mock.type === OutputMockType.MSW;
}

export function isString(x: unknown): x is string {
  return typeof x === 'string';
}

/** A number other than `NaN`. */
export function isNumber(x: unknown): x is number {
  return typeof x === 'number' && !Number.isNaN(x);
}

export function isBoolean(x: unknown): x is boolean {
  return typeof x === 'boolean';
}

// oxlint-disable-next-line typescript/no-explicit-any -- callable after narrowing, as remeda typed it
export function isFunction(x: unknown): x is (...args: any[]) => unknown {
  return typeof x === 'function';
}

export function isNullish(x: unknown): x is null | undefined {
  return x === null || x === undefined;
}

/**
 * Asserts that a spec-supplied numeric constraint really is a finite number.
 *
 * Constraints (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`,
 * `multipleOf`, `minLength`/`maxLength`, `minItems`/`maxItems`) are emitted
 * into generated source as bare, unquoted expressions — `.min(${min})`,
 * `S.minItems(${min})`, `faker.number.int({min: ${min}})`. There is no
 * surrounding quote, so no escaping can make an arbitrary value safe there.
 *
 * OpenAPI 3.1 documents pass validation with these fields set to arbitrary
 * strings, so the value has to be checked here rather than trusted.
 *
 * @param value Constraint value taken from the document
 * @param label Field name, used in the error message
 * @throws If `value` is not a finite number
 */
export function assertSafeNumericConstraint(
  value: unknown,
  label: string,
): number {
  if (!isNumber(value) || !Number.isFinite(value)) {
    throw new Error(
      `orval: refusing to generate code for an OpenAPI document whose "${label}" constraint is not a finite number (got ${String(value)}). This value would otherwise be emitted verbatim into generated source.`,
    );
  }

  return value;
}

/**
 * {@link assertSafeNumericConstraint} for an optional constraint.
 *
 * Passes `undefined` straight through so callers keep "absent" distinct from
 * "present but not a number", which must still be rejected.
 *
 * @param value Constraint value taken from the document, possibly absent
 * @param label Field name, used in the error message
 */
export function safeNumericConstraint(
  value: unknown,
  label: string,
): number | undefined {
  return value === undefined
    ? undefined
    : assertSafeNumericConstraint(value, label);
}
