import { describe, expect, it } from 'vite-plus/test';

import { gen } from './test-helpers';

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
