import { ReferenceObject } from 'openapi3-ts';
import { extname } from 'upath';
import validatorIsUrl from 'validator/lib/isURL';
import { Verbs } from '../types';

/**
 * Discriminator helper for `ReferenceObject`
 *
 * @param property
 */
export const isReference = (property: any): property is ReferenceObject => {
  return Boolean(property.$ref);
};

export const isDirectory = (path: string) => {
  return !extname(path);
};

export function isObject(x: any): x is Record<string, unknown> {
  return Object.prototype.toString.call(x) === '[object Object]';
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
  return typeof x === 'undefined';
}

export function isNull(x: any): x is null {
  return typeof x === null;
}

export const isVerb = (verb: string): verb is Verbs =>
  Object.values(Verbs).includes(verb as Verbs);

export const isRootKey = (specKey: string, target: string) => {
  return specKey === target;
};

const LOCALHOST_REGEX = /^https?:\/\/\w+(\.\w+)*(:[0-9]+)?(\/.*)?$/;

export const isUrl = (str: string) => {
  return validatorIsUrl(str) || LOCALHOST_REGEX.test(str);
};
