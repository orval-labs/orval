import { describe, expect, it } from 'vite-plus/test';

import { SchemaType, Verbs } from '../types';
import {
  isBoolean,
  isDirectory,
  isDynamicReference,
  isFunction,
  isModule,
  isNullish,
  isNumber,
  isNumeric,
  isObject,
  isReference,
  isSchema,
  isSchemaNullable,
  isString,
  isStringLike,
  isUrl,
  isVerb,
} from './assertion';

describe('assertion testing', () => {
  it('checks for reference objects', () => {
    expect(isReference({ $ref: '#/components/schemas/User' })).toBeTruthy();
    expect(isReference({} as Record<string, unknown>)).toBeFalsy();
    expect(isReference({ $dynamicRef: '#category' })).toBeFalsy();
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

  it('checks whether a schema allows null', () => {
    expect(isSchemaNullable({ type: 'string', nullable: true })).toBeTruthy();
    expect(isSchemaNullable({ type: 'null' })).toBeTruthy();
    expect(isSchemaNullable({ type: ['string', 'null'] })).toBeTruthy();

    // OpenAPI 3.1 spells a nullable enum as a separate null branch.
    expect(
      isSchemaNullable({
        anyOf: [{ type: 'string', enum: ['a', 'b'] }, { type: 'null' }],
      }),
    ).toBeTruthy();
    expect(
      isSchemaNullable({
        oneOf: [{ const: 'a' }, { type: 'null' }],
      }),
    ).toBeTruthy();

    expect(isSchemaNullable({ type: 'string', enum: ['a', 'b'] })).toBeFalsy();
    expect(
      isSchemaNullable({
        anyOf: [{ type: 'string' }, { type: 'number' }],
      }),
    ).toBeFalsy();
    // A reference is not resolved here, so it cannot make the schema nullable.
    expect(
      isSchemaNullable({
        anyOf: [{ $ref: '#/components/schemas/NullEnum' }],
      }),
    ).toBeFalsy();
  });

  it('checks for verbs', () => {
    expect(isVerb(Verbs.GET)).toBeTruthy();
    expect(isVerb(Verbs.PUT)).toBeTruthy();
    expect(isVerb(Verbs.POST)).toBeTruthy();
    expect(isVerb(Verbs.DELETE)).toBeTruthy();
    expect(isVerb(Verbs.OPTIONS)).toBeTruthy();
    expect(isVerb(Verbs.HEAD)).toBeTruthy();
    expect(isVerb(Verbs.PATCH)).toBeTruthy();
    expect(isVerb(Verbs.QUERY)).toBeTruthy();

    // Negative checks: casing and unknown verbs
    expect(isVerb('QUERY')).toBeFalsy();
    expect(isVerb('unknown')).toBeFalsy();
    expect(isVerb('')).toBeFalsy();
    expect(isVerb(undefined as unknown as string)).toBeFalsy();
    expect(isVerb(null as unknown as string)).toBeFalsy();
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

describe('isDynamicReference', () => {
  it('returns true for objects with $dynamicRef', () => {
    expect(isDynamicReference({ $dynamicRef: '#category' })).toBe(true);
  });

  it('returns false for objects with $ref', () => {
    expect(isDynamicReference({ $ref: '#/components/schemas/Foo' })).toBe(
      false,
    );
  });

  it('returns false for plain objects', () => {
    expect(isDynamicReference({ type: 'string' })).toBe(false);
  });

  it('returns false for null', () => {
    // eslint-disable-next-line unicorn/no-null
    expect(isDynamicReference(null as unknown as object)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isDynamicReference(undefined as unknown as object)).toBe(false);
  });

  it('returns true for objects with $dynamicRef and other properties', () => {
    expect(
      isDynamicReference({ $dynamicRef: '#category', description: 'test' }),
    ).toBe(true);
  });

  it('returns false for non-string $dynamicRef', () => {
    expect(isDynamicReference({ $dynamicRef: 123 } as unknown as object)).toBe(
      false,
    );
  });

  it('returns true for objects with $ref in isReference', () => {
    expect(isReference({ $ref: '#/components/schemas/Foo' })).toBe(true);
  });
});
