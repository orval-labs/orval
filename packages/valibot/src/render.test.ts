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

  it('emits v.nullish for an optional nullable without a default', () => {
    const { valibot, ok } = gen(
      { type: ['string', 'null'] },
      { required: false },
    );
    expect(valibot).toBe('v.nullish(v.string())');
    expect(ok(null)).toBe(true);
    expect(ok(undefined)).toBe(true);
  });

  it('does not wrap v.null() in v.nullable', () => {
    const { valibot } = gen({ enum: [null], nullable: true } as never);
    expect(valibot).toBe('v.null()');
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
    expect(valibot).not.toContain('v.nullish');
  });

  it('puts default and description on the outer multi-type schema only', () => {
    const { valibot, output } = gen(
      { type: ['string', 'number'], default: 'x', description: 'd' },
      { required: false },
    );
    expect(valibot.match(/v\.description/g)).toHaveLength(1);
    expect(output(undefined)).toBe('x');
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

  it('escapes string defaults', () => {
    const { output } = gen(
      { type: 'string', default: "it's `${x}`" },
      { required: false },
    );
    expect(output(undefined)).toBe("it's `${x}`");
  });
});
