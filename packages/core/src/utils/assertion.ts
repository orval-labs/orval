import {
  type OpenApiReferenceObject,
  type OpenApiSchemaObject,
  SchemaType,
  Verbs,
} from '../types';
import { extname } from './path';

/**
 * Discriminator helper for `ReferenceObject`
 *
 * @param property
 */
export function isReference(obj: object): obj is OpenApiReferenceObject {
  return !isNull(obj) && Object.hasOwn(obj, '$ref');
}

export function isDirectory(path: string) {
  return !extname(path);
}

export function isObject(x: any): x is Record<string, unknown> {
  return Object.prototype.toString.call(x) === '[object Object]';
}

export function isModule(x: any): x is Record<string, unknown> {
  return Object.prototype.toString.call(x) === '[object Module]';
}

export function isString(x: any): x is string {
  return typeof x === 'string';
}

export function isNumber(x: any): x is number {
  return typeof x === 'number';
}

export function isNumeric(x: any): x is number {
  return /^-?\d+$/.test(x);
}

export function isBoolean(x: any): x is boolean {
  return typeof x === 'boolean';
}

export function isFunction(x: any): x is Function {
  return typeof x === 'function';
}

export function isUndefined(x: any): x is undefined {
  return x === undefined;
}

export function isNull(x: any): x is null {
  return x === null;
}

export function isSchema(x: unknown): x is OpenApiSchemaObject {
  if (!isObject(x)) {
    return false;
  }

  if (isString(x.type) && Object.values(SchemaType).includes(x.type)) {
    return true;
  }

  const combine = x.allOf || x.anyOf || x.oneOf;
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
  let givenURL;
  try {
    givenURL = new URL(str);
  } catch {
    return false;
  }
  return givenURL.protocol === 'http:' || givenURL.protocol === 'https:';
}
