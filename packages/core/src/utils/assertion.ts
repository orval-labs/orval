import path from 'node:path';

import { isNullish, isString } from 'remeda';

import {
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
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

export { isBoolean, isFunction, isNullish, isNumber, isString } from 'remeda';
