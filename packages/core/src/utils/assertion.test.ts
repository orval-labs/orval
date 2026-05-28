import { describe, expect, it } from 'vite-plus/test';

import { SchemaType, Verbs } from '../types';
import {
  assertSafeNumericConstraint,
  isBoolean,
  isDirectory,
  isDynamicReference,
  isFunction,
  isModule,
  isNullish,
  isNumber,
  isNumeric,
  isObject,
  isSchema,
  isSchemaNullable,
  isString,
  isStringLike,
  isUrl,
  isVerb,
  safeNumericConstraint,
} from './assertion';

describe('assertion testing', () => {
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

    // OpenAPI 3.1 also spells it as a `null` member of the enum itself, which
    // is the only spelling available when there is no sibling `type` (#4115).
    // eslint-disable-next-line unicorn/no-null -- the 3.1 nullable enum spelling
    expect(isSchemaNullable({ enum: ['a', null] })).toBeTruthy();
    expect(
      // eslint-disable-next-line unicorn/no-null -- the 3.1 nullable enum spelling
      isSchemaNullable({ type: ['string', 'null'], enum: ['a', null] }),
    ).toBeTruthy();

    expect(isSchemaNullable({ type: 'string', enum: ['a', 'b'] })).toBeFalsy();
    // `type` and `enum` are independent assertions that combine with AND, so a
    // `type` refusing null makes the enum's `null` unreachable rather than the
    // schema nullable.
    expect(
      // eslint-disable-next-line unicorn/no-null -- a null the `type` rejects
      isSchemaNullable({ type: 'string', enum: ['a', null] }),
    ).toBeFalsy();
    expect(
      // eslint-disable-next-line unicorn/no-null -- a null the `type` rejects
      isSchemaNullable({ type: ['string'], enum: ['a', null] }),
    ).toBeFalsy();
    // `allOf` is an intersection, so one branch refusing null is enough to make
    // the enum's `null` unreachable.
    expect(
      isSchemaNullable({
        // eslint-disable-next-line unicorn/no-null -- a null the branch rejects
        enum: ['a', null],
        allOf: [{ type: 'string' }],
      }),
    ).toBeFalsy();
    expect(
      isSchemaNullable({
        // eslint-disable-next-line unicorn/no-null -- a null the branch rejects
        enum: ['a', null],
        allOf: [{ enum: ['a'] }],
      }),
    ).toBeFalsy();
    // A branch that admits null, or constrains nothing, leaves it reachable.
    expect(
      isSchemaNullable({
        // eslint-disable-next-line unicorn/no-null -- the 3.1 nullable enum spelling
        enum: ['a', null],
        allOf: [{ type: ['string', 'null'] }],
      }),
    ).toBeTruthy();
    expect(
      isSchemaNullable({
        // eslint-disable-next-line unicorn/no-null -- the 3.1 nullable enum spelling
        enum: ['a', null],
        allOf: [{ description: 'unconstrained' }],
      }),
    ).toBeTruthy();
    // A reference is not resolved here, so it cannot rule null out either.
    expect(
      isSchemaNullable({
        // eslint-disable-next-line unicorn/no-null -- the 3.1 nullable enum spelling
        enum: ['a', null],
        allOf: [{ $ref: '#/components/schemas/Base' }],
      }),
    ).toBeTruthy();
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
});

describe('assertSafeNumericConstraint', () => {
  it('returns a finite number unchanged', () => {
    expect(assertSafeNumericConstraint(0, 'minimum')).toBe(0);
    expect(assertSafeNumericConstraint(-1.5, 'minimum')).toBe(-1.5);
  });

  // These land in generated source as bare expressions, so there is no quote
  // to escape and the value has to be rejected outright.
  it.each<[unknown, string]>([
    ['0); globalThis.pwned=1; void(0', 'a code payload string'],
    ['3', 'a numeric string'],
    [Number.NaN, 'NaN'],
    [Number.POSITIVE_INFINITY, 'Infinity'],
    [true, 'a boolean'],
    [null, 'null'],
    [{}, 'an object'],
  ])('rejects %j (%s)', (value: unknown) => {
    expect(() => assertSafeNumericConstraint(value, 'minimum')).toThrow(
      /"minimum" constraint is not a finite number/,
    );
  });
});

describe('safeNumericConstraint', () => {
  it('passes undefined through so absent stays distinct from invalid', () => {
    expect(safeNumericConstraint(undefined, 'minItems')).toBeUndefined();
  });

  it('returns a finite number unchanged', () => {
    expect(safeNumericConstraint(7, 'minItems')).toBe(7);
  });

  it('rejects a non-numeric value', () => {
    expect(() =>
      safeNumericConstraint('1); globalThis.pwned=1; void(0', 'minItems'),
    ).toThrow(/"minItems" constraint is not a finite number/);
  });
});
