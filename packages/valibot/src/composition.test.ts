import type { OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { gen } from './test-helpers';

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

  it.each([
    ['allOf', 'null'],
    ['allOf', ['null']],
    ['oneOf', 'null'],
    ['anyOf', 'null'],
  ] as const)(
    'reads type null next to %s as a nullable composition (type %j)',
    (key, type) => {
      const { ok } = gen({
        type: typeof type === 'string' ? type : [...type],
        [key]: [a],
      });
      expect(ok(null)).toBe(true);
      expect(ok({ a: 'x' })).toBe(true);
      expect(ok({})).toBe(false);
    },
  );

  it('emits one null for a nullable composition', () => {
    expect(gen({ type: 'null', allOf: [a] }).valibot).toBe(
      'v.union([v.object({\n  a: v.string()\n}), v.null()])',
    );
  });

  it.each([
    ['enum [null]', { enum: [null], allOf: [a] }],
    [
      'a sibling oneOf with null',
      { type: 'null', allOf: [a], oneOf: [b, { type: 'null' }] },
    ],
    [
      'own properties',
      {
        type: 'null',
        properties: { c: { type: 'string' } },
        oneOf: [a, { type: 'null' }],
      },
    ],
  ] satisfies [string, OpenApiSchemaObject][])(
    'accepts null for a nullable composition with %s',
    (_name, schema) => {
      expect(gen(schema).ok(null)).toBe(true);
    },
  );

  it('ignores a composition keyword that is not an array', () => {
    const { ok } = gen({
      type: 'null',
      allOf: [a],
      oneOf: {},
    } as unknown as OpenApiSchemaObject);
    expect(ok(null)).toBe(true);
    expect(ok({ a: 'x' })).toBe(true);
  });

  it('keeps const over a nullable composition', () => {
    expect(gen({ type: 'null', const: null, allOf: [a] }).valibot).toBe(
      'v.null()',
    );
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

  it('applies the parent required keys and discriminator to every group', () => {
    const option = (kind: string): OpenApiSchemaObject => ({
      type: 'object',
      required: ['kind'],
      properties: { kind: { const: kind } },
    });
    const { valibot, ok } = gen({
      required: ['x'],
      allOf: [{ type: 'object', properties: { x: { type: 'string' } } }],
      oneOf: [option('a'), option('b')],
      discriminator: { propertyName: 'kind' },
    });
    expect(valibot).toContain("v.variant('kind'");
    expect(ok({ kind: 'a' })).toBe(false);
    expect(ok({ kind: 'a', x: 'y' })).toBe(true);
  });

  it('requires a key of an allOf member in a later group', () => {
    const { ok } = gen({
      allOf: [{ type: 'object', required: ['x'] }],
      anyOf: [{ type: 'object', properties: { x: { type: 'string' } } }],
    });
    expect(ok({})).toBe(false);
    expect(ok({ x: 'y' })).toBe(true);
  });

  it('leaves a required key to the member that declares it', () => {
    const { valibot } = gen({
      allOf: [
        { type: 'object', properties: { a: { type: 'string' } } },
        { type: 'object', required: ['a'] },
      ],
    });
    expect(valibot.match(/\ba: /g)).toHaveLength(1);
  });

  it('keeps the required keys of oneOf and anyOf alternatives', () => {
    const { ok } = gen({
      anyOf: [
        { type: 'object', required: ['a'] },
        { type: 'object', required: ['b'] },
      ],
    });
    expect(ok({})).toBe(false);
    expect(ok({ b: 1 })).toBe(true);
  });

  describe('alternatives without a type', () => {
    const cpfOrCnpj: OpenApiSchemaObject = {
      type: 'object',
      required: ['name', 'password'],
      properties: {
        name: { type: 'string' },
        password: { type: 'string' },
        cpf: { type: 'string' },
        cnpj: { type: 'string' },
      },
      oneOf: [
        { required: ['cpf', 'name'] },
        { required: ['cnpj', 'password'] },
      ],
    };

    it('requires the keys of an alternative that has only required', () => {
      const { ok } = gen(cpfOrCnpj);
      expect(ok({ name: 'a', password: 'b' })).toBe(false);
      expect(ok({ name: 'a', password: 'b', cpf: '1' })).toBe(true);
      expect(ok({ name: 'a', password: 'b', cnpj: '2' })).toBe(true);
      expect(ok({ password: 'b', cpf: '1' })).toBe(false);
      expect(ok({ name: 'a', password: 'b', cpf: 1 })).toBe(false);
    });

    it('gives each alternative its own copy of the object', () => {
      const { valibot, output } = gen(cpfOrCnpj);
      expect(valibot.match(/v\.union\(/g)).toHaveLength(1);
      expect(valibot.match(/cnpj: v\.optional/g)).toHaveLength(2);
      expect(
        output({ name: 'a', password: 'b', cpf: '1', extra: true }),
      ).toEqual({ name: 'a', password: 'b', cpf: '1' });
    });

    it('does the same for anyOf', () => {
      const { ok } = gen({
        ...cpfOrCnpj,
        oneOf: undefined,
        anyOf: cpfOrCnpj.oneOf,
      });
      expect(ok({ name: 'a', password: 'b' })).toBe(false);
      expect(ok({ name: 'a', password: 'b', cnpj: '2' })).toBe(true);
    });

    it('requires a key that the schema does not declare', () => {
      const { ok } = gen({
        type: 'object',
        properties: { a: { type: 'string' } },
        anyOf: [{ required: ['a'] }, { required: ['b'] }],
      });
      expect(ok({})).toBe(false);
      expect(ok({ a: 'x' })).toBe(true);
      expect(ok({ b: 1 })).toBe(true);
    });

    it('requires the keys of an object without properties', () => {
      const { ok } = gen({
        type: 'object',
        anyOf: [{ required: ['a'] }, { required: ['b'] }],
      });
      expect(ok({})).toBe(false);
      expect(ok('str')).toBe(false);
      expect(ok({ b: 1 })).toBe(true);
    });

    it('keeps the description of an alternative that only requires keys', () => {
      const { valibot } = gen({
        type: 'object',
        properties: { a: { type: 'string' } },
        anyOf: [{ required: ['a'], description: 'Has a.' }, { type: 'null' }],
      });
      expect(valibot).toContain("v.description('Has a.')");
    });

    it('leaves an alternative alone when the schema is not an object', () => {
      const { ok } = gen({
        type: 'string',
        anyOf: [{ required: ['a'] }, { minLength: 2 }],
      });
      expect(ok('x')).toBe(true);
      expect(ok({ a: 1 })).toBe(false);
    });

    it('keeps the type next to members that check nothing', () => {
      const { ok } = gen({
        type: 'string',
        anyOf: [{ format: 'email' }, { pattern: '^\\+\\d+$' }],
      });
      expect(ok('hello')).toBe(true);
      expect(ok(123)).toBe(false);
      expect(ok({ a: 1 })).toBe(false);
    });

    it('keeps the type next to an allOf member that checks nothing', () => {
      const { ok } = gen({ type: 'integer', allOf: [{ maximum: 10 }] });
      expect(ok(5)).toBe(true);
      expect(ok('x')).toBe(false);
      expect(ok(1.5)).toBe(false);
    });
  });

  it('keeps v.variant when the options and discriminators have descriptions', () => {
    const option = (kind: string): OpenApiSchemaObject => ({
      type: 'object',
      description: `The ${kind}.`,
      required: ['kind'],
      properties: {
        kind: { const: kind, description: 'The kind.' },
        x: { type: 'string' },
      },
    });
    const { valibot, ok } = gen({
      oneOf: [option('a'), option('b')],
      discriminator: { propertyName: 'kind' },
    });
    expect(valibot).toContain("v.variant('kind'");
    expect(valibot).not.toContain('description');
    expect(ok({ kind: 'a', x: 'y' })).toBe(true);
    expect(ok({ kind: 'c' })).toBe(false);
  });

  it('applies the scalar keywords next to a composition', () => {
    const { ok } = gen({
      type: 'string',
      minLength: 3,
      anyOf: [
        { type: 'string', pattern: '^a' },
        { type: 'string', pattern: '^b' },
      ],
    });
    expect(ok('abc')).toBe(true);
    expect(ok('ab')).toBe(false);
    expect(ok('cde')).toBe(false);
    expect(ok(1)).toBe(false);
  });

  it('applies items next to a composition', () => {
    const { ok } = gen({
      type: 'array',
      items: { type: 'string' },
      allOf: [{ type: 'array', minItems: 1 }],
    });
    expect(ok(['a'])).toBe(true);
    expect(ok([1])).toBe(false);
    expect(ok([])).toBe(false);
  });

  it('keeps an object accepted when the type next to a composition allows one', () => {
    const { ok } = gen({
      type: ['string', 'object'],
      oneOf: [{ type: 'string' }, a],
    });
    expect(ok({ a: 'x' })).toBe(true);
    expect(ok('x')).toBe(true);
  });

  it('keeps null accepted when a member is null', () => {
    const { ok } = gen({
      type: ['string', 'null'],
      anyOf: [{ type: 'null' }, { type: 'string', format: 'email' }],
    });
    expect(ok(null)).toBe(true);
    expect(ok('a@b.co')).toBe(true);
    expect(ok('x')).toBe(false);
  });

  it('adds nothing for keywords that have no type', () => {
    const { valibot, output } = gen({ minimum: 3, oneOf: [a] });
    expect(valibot).not.toContain('v.unknown()');
    expect(output({ a: 'x', extra: 1 })).toEqual({ a: 'x' });
  });
});
