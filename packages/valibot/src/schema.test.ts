import { runInNewContext } from 'node:vm';

import type { ContextSpec, OpenApiSchemaObject } from '@orval/core';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { renderValibot } from './render';
import { generateValibotValidationSchemaDefinition } from './schema';
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

  it.each([
    [{ type: 'boolean', default: 'true' }],
    [{ type: 'string', enum: ['a', 'b'], default: 'c' }],
    [{ type: 'string', const: 'a', default: 'b' }],
    [{ type: 'array', items: { type: 'string' }, default: 'a' }],
  ] satisfies [OpenApiSchemaObject][])(
    'leaves out a default the schema rejects (%j)',
    (schema) => {
      const { output } = gen({ type: 'object', properties: { n: schema } });
      expect(output({})).toEqual({});
    },
  );

  it('keeps a null default of a nullable schema', () => {
    const { output } = gen({
      type: 'object',
      properties: { n: { type: ['string', 'null'], default: null } },
    });
    expect(output({})).toEqual({ n: null });
  });

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

  it('treats an enum: [null] member of a union as the null branch without a second nullable', () => {
    for (const key of ['oneOf', 'anyOf'] as const) {
      const { valibot, ok } = gen({
        [key]: [{ type: 'string' }, { enum: [null] }],
      });
      expect(valibot).toBe('v.union([v.string(), v.null()])');
      expect(ok(null)).toBe(true);
      expect(ok('a')).toBe(true);
      expect(ok(1)).toBe(false);
    }
  });

  it('keeps the nullable wrapper when the null member is inside an intersect', () => {
    const { ok } = gen({
      type: ['object', 'null'],
      properties: { x: { type: 'string' } },
      anyOf: [
        { type: 'object', properties: { y: { type: 'string' } } },
        { enum: [null] },
      ],
    });
    expect(ok(null)).toBe(true);
  });

  it('reads a string default of a nullable number', () => {
    const { valibot } = gen(
      { type: ['number', 'null'], default: '5' },
      { required: false },
    );
    expect(valibot).toContain(', 5)');
  });
});

describe('formatType', () => {
  const render = (
    schema: OpenApiSchemaObject,
    formatType: NonNullable<ContextSpec['output']['override']['formatType']> = {
      'date-time': { type: 'Day', decode: 'toDay' },
    },
    required = true,
  ) => {
    const context = createTestContextSpec({ override: { formatType } });
    const valibot = renderValibot(
      generateValibotValidationSchemaDefinition(schema, context, false, {
        required,
      }),
    );
    const instance = runInNewContext(valibot, {
      v,
      Date,
      toDay: (value: string) => ({ day: value }),
    }) as v.GenericSchema;
    return { valibot, parse: (input: unknown) => v.parse(instance, input) };
  };
  const dateTime: OpenApiSchemaObject = { type: 'string', format: 'date-time' };

  it('decodes a mapped format after checking the wire string', () => {
    const { valibot, parse } = render(dateTime);
    expect(valibot).toBe(
      'v.pipe(v.string(), v.isoTimestamp(), v.transform((value) => toDay(value)))',
    );
    expect(parse('2025-01-01T09:00:00.000Z')).toEqual({
      day: '2025-01-01T09:00:00.000Z',
    });
  });

  it('decodes a default and keeps null for a nullable value', () => {
    expect(
      render(
        { ...dateTime, default: '2025-01-01T09:00:00.000Z' },
        undefined,
        false,
      ).parse(undefined),
    ).toEqual({ day: '2025-01-01T09:00:00.000Z' });
    expect(render({ ...dateTime, type: ['string', 'null'] }).parse(null)).toBe(
      null,
    );
  });

  it('fails for a mapped format without decode', () => {
    expect(() => render(dateTime, { 'date-time': { type: 'Day' } })).toThrow(
      'override.formatType.date-time (Day): Valibot schemas need `decode`',
    );
  });

  it('fails for a mapped format next to allOf', () => {
    expect(() => render({ ...dateTime, allOf: [{ minLength: 1 }] })).toThrow(
      "override.formatType.date-time (Day): Valibot schemas can't convert it next to allOf/oneOf/anyOf",
    );
  });

  it('types a `Date` mapping like useDates and leaves unions unmapped', () => {
    expect(
      render(dateTime, { 'date-time': { type: 'Date' } }).parse(
        '2025-01-01T09:00:00.000Z',
      ),
    ).toBeInstanceOf(Date);
    expect(render({ ...dateTime, type: ['string', 'number'] }).valibot).toBe(
      'v.union([v.pipe(v.string(), v.isoTimestamp()), v.number()])',
    );
  });

  it('validates an unmapped binary member of a union as a string', () => {
    expect(
      render(
        { type: ['string', 'number'], format: 'binary' },
        { binary: { type: 'Day', decode: 'toDay' } },
      ).valibot,
    ).toBe('v.union([v.string(), v.number()])');
  });

  it('keeps the mapped formats of an object member of the union', () => {
    const { parse } = render({
      ...dateTime,
      type: ['string', 'object'],
      properties: { at: dateTime },
    });
    expect(parse('2025-01-01T09:00:00.000Z')).toBe('2025-01-01T09:00:00.000Z');
    expect(parse({ at: '2025-01-01T09:00:00.000Z' })).toEqual({
      at: { day: '2025-01-01T09:00:00.000Z' },
    });
  });
});
