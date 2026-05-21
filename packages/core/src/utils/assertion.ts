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
 * Discriminator helper for `ReferenceObject`
 *
 * @param property
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

export function isDirectory(pathValue: string) {
  return !path.extname(pathValue);
}

export function isObject(x: unknown): x is Record<string, unknown> {
  return Object.prototype.toString.call(x) === '[object Object]';
}

export function isStringLike(val: unknown): val is string {
  if (isString(val)) {
    return true;
  }

  return Object.prototype.toString.call(val) === '[object String]';
}

export function isModule(x: unknown): x is Record<string, unknown> {
  return Object.prototype.toString.call(x) === '[object Module]';
}

export function isNumeric(x: unknown): x is number {
  if (typeof x === 'number') return Number.isInteger(x);
  return isString(x) && /^-?\d+$/.test(x);
}

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

export function isVerb(verb: string): verb is Verbs {
  return Object.values(Verbs).includes(verb as Verbs);
}

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
 */
export function isMswMock(
  mock: GlobalMockOptions | ClientMockBuilder,
): mock is MswMockOptions {
  return !isFunction(mock) && mock.type === OutputMockType.MSW;
}

/**
 * Type guard for the Faker mock generator. Use to narrow a
 * `GlobalMockOptions | ClientMockBuilder` value to `FakerMockOptions`.
 */
export function isFakerMock(
  mock: GlobalMockOptions | ClientMockBuilder,
): mock is FakerMockOptions {
  return !isFunction(mock) && mock.type === OutputMockType.FAKER;
}

export { isBoolean, isFunction, isNullish, isNumber, isString } from 'remeda';
