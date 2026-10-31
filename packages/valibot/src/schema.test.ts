import type { OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { gen } from './test-helpers';

describe('scalars', () => {
  it('emits v.string, v.number, v.boolean and v.null', () => {
    expect(gen({ type: 'string' }).valibot).toBe('v.string()');
    expect(gen({ type: 'number' }).valibot).toBe('v.number()');
    expect(gen({ type: 'boolean' }).valibot).toBe('v.boolean()');
    expect(gen({ type: 'null' }).valibot).toBe('v.null()');
  });

  it('checks integer', () => {
    const { valibot, ok } = gen({ type: 'integer' });
    expect(valibot).toBe('v.pipe(v.number(), v.integer())');
    expect(ok(1)).toBe(true);
    expect(ok(1.5)).toBe(false);
  });

  it('renders true and false schemas', () => {
    expect(gen(true).valibot).toBe('v.unknown()');
    expect(gen(false).valibot).toBe('v.never()');
  });

  it('unions the types of a multi-type schema', () => {
    const { ok } = gen({ type: ['string', 'number'] });
    expect(ok('a')).toBe(true);
    expect(ok(1)).toBe(true);
    expect(ok(true)).toBe(false);
  });
});

describe('enums and literals', () => {
  it('emits v.picklist for string and numeric enums', () => {
    expect(gen({ type: 'string', enum: ['a', 'b'] }).valibot).toBe(
      "v.picklist(['a', 'b'])",
    );
    expect(gen({ type: 'integer', enum: [1, 2] }).ok(2)).toBe(true);
  });

  it('keeps a mixed enum as literals and a null member as nullable', () => {
    const { valibot, ok } = gen({ enum: [1, 'two', true, null] });
    expect(valibot).toBe(
      "v.nullable(v.union([v.literal(1), v.literal('two'), v.literal(true)]))",
    );
    expect(ok(null)).toBe(true);
    expect(ok('three')).toBe(false);
  });

  it('does not add a type check on top of a const', () => {
    const { valibot, ok } = gen({ const: 'pet', enum: ['pet', 'cat'] });
    expect(valibot).toBe("v.literal('pet')");
    expect(ok('cat')).toBe(false);
  });

  it('emits v.null for a null type with a null enum', () => {
    expect(gen({ type: 'null', enum: [null] }).valibot).toBe('v.null()');
  });

  it('escapes quotes and backslashes in enum values', () => {
    const { ok } = gen({ type: 'string', enum: ["it's", 'a\\b'] });
    expect(ok("it's")).toBe(true);
    expect(ok('a\\b')).toBe(true);
  });

  it('does not enforce an enum with array or object members', () => {
    const { valibot } = gen({ enum: ['a', ['b'], { c: 1 }] } as never);
    expect(valibot).toBe('v.unknown()');
  });
});

describe('objects', () => {
  const schema: OpenApiSchemaObject = {
    type: 'object',
    required: ['a'],
    properties: { a: { type: 'string' }, b: { type: 'number' } },
  };

  it('strips unknown keys by default and rejects them when strict', () => {
    expect(gen(schema).output({ a: 'x', z: 1 })).toEqual({ a: 'x' });
    expect(gen(schema, { strict: true }).ok({ a: 'x', z: 1 })).toBe(false);
  });

  it('requires the required keys only', () => {
    const { ok } = gen(schema);
    expect(ok({ a: 'x' })).toBe(true);
    expect(ok({ b: 1 })).toBe(false);
  });

  it('keeps extra keys for additionalProperties: true', () => {
    const { output } = gen({ ...schema, additionalProperties: true });
    expect(output({ a: 'x', z: 1 })).toEqual({ a: 'x', z: 1 });
  });

  it('checks extra keys against a typed additionalProperties', () => {
    const { valibot, ok } = gen({
      ...schema,
      additionalProperties: { type: 'number' },
    });
    expect(valibot).toContain('v.objectWithRest(');
    expect(ok({ a: 'x', z: 1 })).toBe(true);
    expect(ok({ a: 'x', z: 'no' })).toBe(false);
  });

  it('emits v.record for additionalProperties without properties', () => {
    const { valibot, ok } = gen({
      type: 'object',
      additionalProperties: { type: 'integer' },
    });
    expect(valibot).toContain('v.record(v.string(),');
    expect(ok({ x: 1 })).toBe(true);
    expect(ok({ x: 'a' })).toBe(false);
  });

  it('emits a strict empty object for additionalProperties: false', () => {
    const closed: OpenApiSchemaObject = {
      type: 'object',
      additionalProperties: false,
    };
    const strict = gen(closed, { strict: true });
    expect(strict.valibot).toBe('v.strictObject({})');
    expect(strict.ok({})).toBe(true);
    expect(strict.ok({ a: 1 })).toBe(false);

    // Same as an object with properties: unknown keys are stripped unless strict.
    const loose = gen(closed);
    expect(loose.valibot).toBe('v.object({})');
    expect(loose.output({ a: 1 })).toEqual({});
  });

  it('keeps a required key that has no property', () => {
    const { valibot, ok, output } = gen({
      type: 'object',
      required: ['id'],
      properties: { name: { type: 'string' } },
    });
    expect(valibot).toContain('id: v.unknown()');
    expect(output({ id: 1, name: 'x' })).toEqual({ id: 1, name: 'x' });
    expect(
      gen(
        {
          type: 'object',
          required: ['id'],
          properties: { a: { type: 'string' } },
        },
        { strict: true },
      ).ok({ id: 1 }),
    ).toBe(true);
    expect(ok({ id: 1 })).toBe(true);
    expect(ok({ name: 'x' })).toBe(false);
  });

  it.each([
    ['number', '1.5', 1.5],
    ['number', '-2e3', -2000],
    ['integer', '7', 7],
  ] as const)(
    'reads the string default of a %s as a number',
    (type, text, value) => {
      const { valibot, output } = gen({
        type: 'object',
        properties: { n: { type, default: text } },
      });
      expect(valibot).not.toContain(`'${text}'`);
      expect(output({})).toEqual({ n: value });
    },
  );

  it.each([
    ['number', 'NaN'],
    ['number', 'Infinity'],
    ['number', '0x10'],
    ['number', '__proto__'],
    ['number', Number.POSITIVE_INFINITY],
    ['integer', '1.5'],
  ] as const)('leaves out a default a %s rejects (%s)', (type, value) => {
    const { output } = gen({
      type: 'object',
      properties: { n: { type, default: value } },
    });
    expect(output({})).toEqual({});
  });

  it.each([
    [{ type: 'number', enum: ['1', '2'], default: '1' }, '1'],
    [{ type: ['number', 'string'], default: 'abc' }, 'abc'],
  ] satisfies [OpenApiSchemaObject, unknown][])(
    'keeps a string default that the schema can accept',
    (schema, value) => {
      const { output } = gen({
        type: 'object',
        properties: { n: schema },
      });
      expect(output({})).toEqual({ n: value });
    },
  );

  it('does not apply a default to a required key without a property', () => {
    const { ok } = gen({
      type: 'object',
      required: ['a'],
      additionalProperties: { type: 'string', default: 'z' },
    });
    expect(ok({})).toBe(false);
    expect(ok({ a: 'x' })).toBe(true);
  });

  it('keeps the other keys of an object that only lists required keys', () => {
    const { valibot, output } = gen({ type: 'object', required: ['id'] });
    expect(valibot).toBe('v.looseObject({\n  id: v.unknown()\n})');
    expect(output({ id: 1, z: 2 })).toEqual({ id: 1, z: 2 });
  });

  it('checks a required key without a property against additionalProperties', () => {
    const { ok } = gen({
      type: 'object',
      required: ['id'],
      additionalProperties: { type: 'number' },
    });
    expect(ok({ id: 1 })).toBe(true);
    expect(ok({ id: 'x' })).toBe(false);
  });

  it('quotes odd keys and keeps inherited names as own keys', () => {
    const { valibot, ok, output } = gen({
      type: 'object',
      required: ['constructor', '__proto__'],
      properties: Object.fromEntries([
        ['weird key', { type: 'string' }],
        ['__proto__', { type: 'string' }],
        ['constructor', { type: 'string' }],
      ]),
    });
    expect(valibot).toContain("'weird key'");
    expect(valibot).toContain("['__proto__']");
    expect(ok({})).toBe(false);
    expect(output({ constructor: 'a', ['__proto__']: 'b' })).toBeDefined();
  });

  it('validates a tuple as an array of unknown', () => {
    const { valibot, ok } = gen({
      type: 'array',
      prefixItems: [{ type: 'string' }, { type: 'number' }],
    } as OpenApiSchemaObject);
    expect(valibot).toBe('v.array(v.unknown())');
    expect(ok(['a', 1])).toBe(true);
  });

  it('falls back to unknown for a type that is not a JSON Schema type', () => {
    const hostile = 'x(); console.log(1); v.string';
    expect(gen({ type: hostile } as never).valibot).toBe('v.unknown()');
    expect(gen({ type: 'foo' } as never).valibot).toBe('v.unknown()');
  });

  it('does not enforce an enum of objects', () => {
    const { valibot, ok } = gen({ type: 'object', enum: [{ a: 1 }] });
    expect(valibot).not.toContain('v.never()');
    expect(ok({ a: 2 })).toBe(true);
  });

  it('validates { not: {} } as never', () => {
    expect(gen({ not: {} }).valibot).toBe('v.never()');
  });
});
