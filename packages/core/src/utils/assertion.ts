import path from 'node:path';

import { isFunction, isNullish, isString } from 'remeda';

import {
  type ClientMockBuilder,
  type FakerMockOptions,
  type GlobalMockOptions,
  type MswMockOptions,
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  OutputMockType,
  SchemaType,
  Verbs,
} from '../types';

/**
 * Type guard for an OpenAPI {@link OpenApiReferenceObject}.
 *
 * Returns `true` when `obj` has a `$ref` property, indicating a static
 * JSON Pointer reference rather than an inline schema.
 *
 * @param obj - Value to test.
 */
export function isReference(obj: object): obj is OpenApiReferenceObject {
  return !isNullish(obj) && Object.hasOwn(obj, '$ref');
}

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
 * Type guard for string primitives and `String` wrapper objects.
 *
 * @param val - Value to test.
 */
export function isStringLike(val: unknown): val is string {
  if (isString(val)) {
    return true;
  }

  return Object.prototype.toString.call(val) === '[object String]';
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
 * Does not match reference objects; use {@link isReference} for those.
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

/**
 * Type guard for the Faker mock generator. Use to narrow a
 * `GlobalMockOptions | ClientMockBuilder` value to `FakerMockOptions`.
 *
 * @param mock - Mock configuration or builder to test.
 */
export function isFakerMock(
  mock: GlobalMockOptions | ClientMockBuilder,
): mock is FakerMockOptions {
  return !isFunction(mock) && mock.type === OutputMockType.FAKER;
}

/** Re-exported Remeda type guards and predicates used alongside local assertions. */
export { isBoolean, isFunction, isNullish, isNumber, isString } from 'remeda';
