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
});
