import { describe, expect, it } from 'vitest';

import { SchemaType, Verbs } from '../types';
import {
  isBoolean,
  isDirectory,
  isFunction,
  isModule,
  isNullish,
  isNumber,
  isNumeric,
  isObject,
  isReference,
  isSchema,
  isString,
  isStringLike,
  isUrl,
  isVerb,
} from './assertion';

describe('assertion testing', () => {
  it('checks for reference objects', () => {
    expect(isReference({ $ref: '#/components/schemas/User' })).toBeTruthy();
    expect(isReference({} as Record<string, unknown>)).toBeFalsy();
    // eslint-disable-next-line unicorn/no-null -- testing null handling
    expect(isReference(null as unknown as object)).toBeFalsy();
  });

  it('checks for directory-like paths', () => {
    expect(isDirectory('src/utils')).toBeTruthy();
    expect(isDirectory('src/utils/index.ts')).toBeFalsy();
  });

  it('checks for plain objects', () => {
    expect(isObject({})).toBeTruthy();
    expect(isObject([])).toBeFalsy();
    // eslint-disable-next-line unicorn/no-null -- testing null handling
    expect(isObject(null)).toBeFalsy();
  });

  it('checks for string-like values', () => {
    expect(isStringLike('hello')).toBeTruthy();
    expect(isStringLike(new Object('hello'))).toBeTruthy();
    expect(isStringLike(123)).toBeFalsy();
  });

  it('checks for module-like objects', () => {
    const moduleLike = { [Symbol.toStringTag]: 'Module' };
    expect(isModule(moduleLike)).toBeTruthy();
    expect(isModule({})).toBeFalsy();
  });

  it('checks for numeric strings', () => {
    expect(isNumeric('123')).toBeTruthy();
    expect(isNumeric('-42')).toBeTruthy();
    expect(isNumeric(10)).toBeTruthy();
    expect(isNumeric('12.3')).toBeFalsy();
    expect(isNumeric('abc')).toBeFalsy();
  });

  it('checks for schema-like objects', () => {
    expect(isSchema({ type: SchemaType.object })).toBeTruthy();
    expect(isSchema({ anyOf: [] })).toBeTruthy();
    expect(isSchema({ properties: {} })).toBeTruthy();
    expect(isSchema({ type: 'not-a-schema' })).toBeFalsy();
    // eslint-disable-next-line unicorn/no-null -- testing null handling
    expect(isSchema(null)).toBeFalsy();
  });

  it('checks for verbs', () => {
    expect(isVerb(Verbs.GET)).toBeTruthy();
    expect(isVerb('options')).toBeFalsy();
  });

  it('checks for valid URLs', () => {
    expect(isUrl('http://my-docker-service/docs.json')).toBeTruthy();
    expect(isUrl('https://www.example.com')).toBeTruthy();
    expect(isUrl('http://localhost:8080/docs/spec.yaml')).toBeTruthy();
    expect(isUrl('http://localhost/test.json')).toBeTruthy();
    expect(isUrl('http://localhost:6001/swagger/v1/swagger.json')).toBeTruthy();
    expect(isUrl('D:/a/test.txt')).toBeFalsy();
    expect(isUrl('./file.txt')).toBeFalsy();
    expect(isUrl('')).toBeFalsy();
  });

  it('checks re-exported assertions', () => {
    expect(isBoolean(true)).toBeTruthy();
    expect(isNumber(1)).toBeTruthy();
    expect(isString('test')).toBeTruthy();
    // eslint-disable-next-line unicorn/new-for-builtins
    expect(isString(new String('test'))).toBeFalsy();
    expect(
      isFunction(() => {
        /* empty */
      }),
    ).toBeTruthy();
    // eslint-disable-next-line unicorn/no-null -- testing null handling
    expect(isNullish(null)).toBeTruthy();
  });
});
