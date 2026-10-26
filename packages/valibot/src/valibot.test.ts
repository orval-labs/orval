import { runInNewContext } from 'node:vm';

import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiParameterObject,
  OpenApiSchemaObject,
} from '@orval/core';
import * as v from 'valibot';
import { describe, expect, it } from 'vite-plus/test';

import {
  generateValibot,
  generateValibotValidationSchemaDefinition,
  getValibotDependencies,
  renderValibot,
} from '.';
import { createTestContextSpec } from '../../core/src/test-utils';

// Renders a schema and evaluates it against the real `valibot`, so a test
// asserts what the output accepts and rejects, not only how it is spelled.
const gen = (
  schema: OpenApiSchemaObject,
  options?: {
    required?: boolean;
    strict?: boolean;
    exactOptional?: boolean;
    useDates?: boolean;
  },
) => {
  const context = createTestContextSpec({
    output: { override: { useDates: options?.useDates ?? false } },
  });
  const valibot = renderValibot(
    generateValibotValidationSchemaDefinition(
      schema,
      context,
      options?.strict ?? false,
      { required: options?.required ?? true },
    ),
    { exactOptional: options?.exactOptional },
  );
  const instance = runInNewContext(valibot, {
    v,
    File,
    Date,
  }) as v.GenericSchema;
  const ok = (input: unknown) => v.safeParse(instance, input).success;
  const output = (input: unknown) => v.parse(instance, input) as unknown;
  return { valibot, ok, output };
};

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

describe('constraints', () => {
  it('maps string length and array size to minLength/maxLength', () => {
    const string = gen({ type: 'string', minLength: 2, maxLength: 3 });
    expect(string.ok('ab')).toBe(true);
    expect(string.ok('a')).toBe(false);
    expect(string.ok('abcd')).toBe(false);

    const array = gen({
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 2,
    });
    expect(array.ok([])).toBe(false);
    expect(array.ok(['a', 'b', 'c'])).toBe(false);
  });

  it('uses v.minLength where code units and code points agree', () => {
    expect(gen({ type: 'string', minLength: 1 }).valibot).toContain(
      'v.minLength(1)',
    );
  });

  it('counts string length in code points', () => {
    const { ok } = gen({ type: 'string', minLength: 2, maxLength: 2 });
    expect(ok('😀😀')).toBe(true);
    expect(ok('😀')).toBe(false);
    expect(ok('😀😀😀')).toBe(false);
  });

  it('keeps a maxItems of 0', () => {
    const { ok } = gen({ type: 'array', items: {}, maxItems: 0 });
    expect(ok([])).toBe(true);
    expect(ok([1])).toBe(false);
  });

  it('maps numeric bounds, exclusive bounds and multipleOf', () => {
    const bounded = gen({ type: 'number', minimum: 0, maximum: 10 });
    expect(bounded.ok(0)).toBe(true);
    expect(bounded.ok(11)).toBe(false);

    const exclusive = gen({
      type: 'number',
      exclusiveMinimum: 0,
      exclusiveMaximum: 10,
    });
    expect(exclusive.ok(0)).toBe(false);
    expect(exclusive.ok(10)).toBe(false);
    expect(exclusive.ok(5)).toBe(true);

    expect(gen({ type: 'number', multipleOf: 5 }).ok(7)).toBe(false);
  });

  it('rejects a non-finite constraint instead of emitting it', () => {
    expect(() =>
      gen({ type: 'number', minimum: Number.POSITIVE_INFINITY }),
    ).toThrow();
    expect(() =>
      gen({ type: 'array', maxItems: 'x); evil(' as unknown as number }),
    ).toThrow();
  });

  it('uses a pattern as written, including slashes', () => {
    const { ok } = gen({ type: 'string', pattern: '/api/' });
    expect(ok('/api/')).toBe(true);
    expect(ok('api')).toBe(false);
  });

  it('adds the u flag only for unicode property escapes', () => {
    expect(gen({ type: 'string', pattern: '^[a-z]+$' }).valibot).not.toContain(
      "'u'",
    );
    const unicode = gen({ type: 'string', pattern: '^\\p{L}+$' });
    expect(unicode.valibot).toContain("'u'");
    expect(unicode.ok('é')).toBe(true);
  });

  it('skips a pattern that is not a JavaScript RegExp', () => {
    const { valibot, ok } = gen({ type: 'string', pattern: '(?i)abc' });
    expect(valibot).toBe('v.string()');
    expect(ok('anything')).toBe(true);
  });

  it('escapes a pattern that contains a quote', () => {
    const { ok } = gen({ type: 'string', pattern: "^it's$" });
    expect(ok("it's")).toBe(true);
  });
});

describe('formats', () => {
  it('uses isoTimestamp for date-time, which accepts an offset', () => {
    const { ok } = gen({ type: 'string', format: 'date-time' });
    expect(ok('2024-01-01T10:00:00Z')).toBe(true);
    expect(ok('2024-01-01T10:00:00+02:00')).toBe(true);
    expect(ok('2024-01-01')).toBe(false);
  });

  it('validates date, email, uri and uuid', () => {
    expect(gen({ type: 'string', format: 'date' }).ok('2024-13-01')).toBe(
      false,
    );
    expect(gen({ type: 'string', format: 'email' }).ok('a@b.co')).toBe(true);
    expect(gen({ type: 'string', format: 'uri' }).ok('/relative')).toBe(false);
    expect(
      gen({ type: 'string', format: 'uuid' }).ok(
        '123e4567-e89b-12d3-a456-426614174000',
      ),
    ).toBe(true);
  });

  it('turns date and date-time into Date with useDates, after the checks', () => {
    const { valibot, output } = gen(
      { type: 'string', format: 'date-time', maxLength: 30, pattern: '^2024' },
      { useDates: true },
    );
    expect(output('2024-01-01T00:00:00Z')).toBeInstanceOf(Date);
    expect(valibot.indexOf('v.regex')).toBeLessThan(
      valibot.indexOf('v.transform'),
    );
  });

  it('accepts a File for binary and rejects a plain Blob', () => {
    const { ok } = gen({ type: 'string', format: 'binary' });
    expect(ok(new File(['x'], 'a.txt'))).toBe(true);
    expect(ok(new Blob(['x']))).toBe(false);
  });

  it('ignores an inherited property name as a format', () => {
    for (const format of ['constructor', '__proto__', 'toString']) {
      expect(gen({ type: 'string', format }).valibot).toBe('v.string()');
    }
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

  it('drops array and object enum members', () => {
    const { valibot } = gen({ enum: ['a', ['b'], { c: 1 }] } as never);
    expect(valibot).toBe("v.literal('a')");
  });
});

describe('nullable, optional and defaults', () => {
  it('wraps a type array with null in v.nullable', () => {
    const { ok } = gen({ type: ['string', 'null'] });
    expect(ok(null)).toBe(true);
    expect(ok(undefined)).toBe(false);
  });

  it('does not wrap a null member of a union twice', () => {
    const { valibot } = gen({ anyOf: [{ type: 'string' }, { type: 'null' }] });
    expect(valibot).toBe('v.union([v.string(), v.null()])');
  });

  it('accepts undefined and null when optional and nullable', () => {
    const { ok } = gen({ type: ['string', 'null'] }, { required: false });
    expect(ok(undefined)).toBe(true);
    expect(ok(null)).toBe(true);
  });

  it('applies a default for undefined only', () => {
    const { valibot, output, ok } = gen(
      { type: 'integer', default: 5 },
      { required: false },
    );
    expect(valibot).toContain(', 5)');
    expect(output(undefined)).toBe(5);
    expect(ok(null)).toBe(false);
  });

  it('keeps null for a nullable with a default', () => {
    const { output } = gen(
      { type: ['integer', 'null'], default: 5 },
      { required: false },
    );
    expect(output(undefined)).toBe(5);
    expect(output(null)).toBeNull();
  });

  it('emits v.exactOptional when asked to, also for a nullable', () => {
    const { valibot } = gen(
      {
        type: 'object',
        properties: {
          a: { type: 'string' },
          b: { type: ['string', 'null'] },
        },
      },
      { exactOptional: true },
    );
    expect(valibot).toContain('v.exactOptional(v.string())');
    expect(valibot).toContain('v.exactOptional(v.nullable(v.string()))');
  });

  it('escapes string defaults', () => {
    const { output } = gen(
      { type: 'string', default: "it's `${x}`" },
      { required: false },
    );
    expect(output(undefined)).toBe("it's `${x}`");
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
});

describe('composition', () => {
  const a: OpenApiSchemaObject = {
    type: 'object',
    required: ['a'],
    properties: { a: { type: 'string' } },
  };
  const b: OpenApiSchemaObject = {
    type: 'object',
    required: ['b'],
    properties: { b: { type: 'number' } },
  };

  it('emits v.union for oneOf and anyOf', () => {
    expect(
      gen({ oneOf: [{ type: 'string' }, { type: 'number' }] }).valibot,
    ).toBe('v.union([v.string(), v.number()])');
    expect(
      gen({ anyOf: [{ type: 'string' }, { type: 'number' }] }).valibot,
    ).toBe('v.union([v.string(), v.number()])');
  });

  it('emits v.intersect for allOf and merges the outputs', () => {
    const { valibot, output } = gen({ allOf: [a, b] });
    expect(valibot).toContain('v.intersect');
    expect(output({ a: 'x', b: 1 })).toEqual({ a: 'x', b: 1 });
  });

  it('keeps an allOf of strict objects valid', () => {
    const { ok } = gen({ allOf: [a, b] }, { strict: true });
    expect(ok({ a: 'x', b: 1 })).toBe(true);
  });

  it('intersects a union with the properties next to it', () => {
    const { ok } = gen({
      oneOf: [a, b],
      properties: { c: { type: 'string' } },
    });
    expect(ok({ a: 'x', c: 'y' })).toBe(true);
  });

  it('forces a key required by the parent onto an allOf member', () => {
    const { ok } = gen({
      required: ['b'],
      allOf: [{ type: 'object', properties: { b: { type: 'string' } } }],
    });
    expect(ok({})).toBe(false);
    expect(ok({ b: 'x' })).toBe(true);
  });

  it('forces a required key through a discriminated union and an open object', () => {
    const option = (kind: string): OpenApiSchemaObject => ({
      type: 'object',
      required: ['kind'],
      properties: { kind: { const: kind }, x: { type: 'string' } },
    });
    const variant = gen({
      required: ['x'],
      allOf: [
        {
          oneOf: [option('a'), option('b')],
          discriminator: { propertyName: 'kind' },
        },
      ],
    });
    expect(variant.ok({ kind: 'a' })).toBe(false);
    expect(variant.ok({ kind: 'a', x: 'y' })).toBe(true);

    const rest = gen({
      required: ['x'],
      allOf: [
        {
          type: 'object',
          properties: { x: { type: 'string' } },
          additionalProperties: { type: 'number' },
        },
      ],
    });
    expect(rest.ok({})).toBe(false);
  });

  it('emits v.variant for a discriminator on literal keys', () => {
    const cat: OpenApiSchemaObject = {
      type: 'object',
      required: ['kind'],
      properties: { kind: { type: 'string', enum: ['cat'] } },
    };
    const dog: OpenApiSchemaObject = {
      type: 'object',
      required: ['kind'],
      properties: { kind: { const: 'dog' } },
    };
    const { valibot, ok } = gen({
      oneOf: [cat, dog],
      discriminator: { propertyName: 'kind' },
    });
    expect(valibot).toContain("v.variant('kind'");
    expect(ok({ kind: 'dog' })).toBe(true);
    expect(ok({ kind: 'fish' })).toBe(false);
  });

  it('stays a union when a discriminator is not a literal', () => {
    const { valibot } = gen({
      oneOf: [
        { type: 'object', properties: { kind: { type: 'string' } } },
        { type: 'object', properties: { kind: { const: 'dog' } } },
      ],
      discriminator: { propertyName: 'kind' },
    });
    expect(valibot).not.toContain('v.variant');
    expect(valibot).toContain('v.union');
  });

  it('stays a union when an option is not an object', () => {
    const { valibot } = gen({
      oneOf: [
        { type: 'object', properties: { kind: { const: 'a' } } },
        { type: 'string' },
      ],
      discriminator: { propertyName: 'kind' },
    });
    expect(valibot).not.toContain('v.variant');
  });
});

describe('review regressions', () => {
  it('skips a fractional multipleOf and keeps an integer one', () => {
    expect(gen({ type: 'number', multipleOf: 0.01 }).ok(19.99)).toBe(true);
    expect(gen({ type: 'number', multipleOf: 5 }).valibot).toContain(
      'v.multipleOf(5)',
    );
  });

  it('puts default and description on the outer multi-type schema only', () => {
    const { valibot, output } = gen(
      { type: ['string', 'number'], default: 'x', description: 'd' },
      { required: false },
    );
    expect(valibot.match(/v\.description/g)).toHaveLength(1);
    expect(output(undefined)).toBe('x');
  });

  it('applies the parent required to oneOf members', () => {
    const { ok } = gen({
      required: ['id'],
      oneOf: [{ type: 'object', properties: { id: { type: 'string' } } }],
    });
    expect(ok({})).toBe(false);
  });

  it('intersects every composition keyword', () => {
    const { ok } = gen({
      allOf: [{ type: 'object', required: ['a'], properties: { a: {} } }],
      oneOf: [
        { type: 'object', required: ['b'], properties: { b: {} } },
        { type: 'object', required: ['c'], properties: { c: {} } },
      ],
    });
    expect(ok({ a: 1 })).toBe(false);
    expect(ok({ a: 1, c: 1 })).toBe(true);
  });

  it('emits v.file() so the module loads without a global File', () => {
    expect(gen({ type: 'string', format: 'binary' }).valibot).toBe('v.file()');
  });

  it('does not convert dates inside an allOf', () => {
    const { ok } = gen(
      {
        allOf: [{ type: 'string', format: 'date-time' }, { description: 'x' }],
      },
      { useDates: true },
    );
    expect(ok('2024-01-01T00:00:00Z')).toBe(true);
  });

  it('keeps a null property schema optional', () => {
    const { ok } = gen({
      type: 'object',
      properties: { a: null },
    } as never);
    expect(ok({})).toBe(true);
  });

  it('uses v.optional outside object entries with exactOptional', () => {
    const { ok } = gen(
      { type: 'array', items: { type: 'string', default: 'z' } },
      { exactOptional: true },
    );
    expect(ok([undefined])).toBe(true);
  });
});

describe('operations', () => {
  const run = async (
    schema: OpenApiSchemaObject,
    {
      code = '200',
      contentType = 'application/json',
      parameters = [],
      components = {},
    }: {
      code?: string;
      contentType?: string;
      parameters?: OpenApiParameterObject[];
      components?: Record<string, OpenApiSchemaObject>;
    } = {},
  ) => {
    const context = createTestContextSpec({
      spec: {
        components: { schemas: components },
        paths: {
          '/pets': {
            get: {
              parameters,
              responses: {
                [code]: {
                  description: 'ok',
                  content: { [contentType]: { schema } },
                },
              },
            },
          },
        },
      },
    });
    const { implementation } = await generateValibot(
      {
        typeName: 'listPets',
        verb: 'get',
        override: {
          ...context.output.override,
          valibot: {
            strict: {
              param: false,
              query: false,
              header: false,
              body: false,
              response: false,
            },
            generate: {
              param: true,
              query: true,
              header: true,
              body: true,
              response: true,
            },
            exactOptional: false,
          },
        },
      } as GeneratorVerbOptions,
      { pathRoute: '/pets', context } as GeneratorOptions,
      'valibot',
    );
    return implementation;
  };

  it('imports valibot as a namespace', () => {
    expect(getValibotDependencies()[0]).toMatchObject({
      dependency: 'valibot',
      exports: [{ name: 'v', namespaceImport: true }],
    });
  });

  it('emits a response const per operation', async () => {
    expect(await run({ type: 'string' })).toContain(
      'export const ListPetsResponse = v.string()',
    );
  });

  it('validates a +json vendor type and a 201 response', async () => {
    const implementation = await run(
      { type: 'string' },
      { code: '201', contentType: 'application/hal+json; charset=utf-8' },
    );
    expect(implementation).toContain('ListPetsResponse = v.string()');
  });

  it('emits an array response with its size limits', async () => {
    const implementation = await run({
      type: 'array',
      maxItems: 0,
      items: { type: 'string' },
    });
    expect(implementation).toContain(
      'v.pipe(v.array(v.string()), v.maxLength(0))',
    );
  });

  it('inlines a $ref and validates a circular one as unknown', async () => {
    const implementation = await run(
      { $ref: '#/components/schemas/Node' },
      {
        components: {
          Node: {
            type: 'object',
            required: ['id'],
            properties: {
              id: { type: 'string' },
              next: { $ref: '#/components/schemas/Node' },
            },
          },
        },
      },
    );
    expect(implementation).toContain('id: v.string()');
    expect(implementation).toContain('next: v.optional(v.unknown())');
  });

  it('keeps parameters named like Object.prototype members', async () => {
    const implementation = await run(
      { type: 'string' },
      {
        parameters: [
          {
            name: 'constructor',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          { name: '__proto__', in: 'query', schema: { type: 'string' } },
        ],
      },
    );
    expect(implementation).toContain('constructor: v.string()');
    expect(implementation).toContain("['__proto__']: v.optional(v.string())");
  });
});
