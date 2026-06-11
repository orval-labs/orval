import type { ContextSpec, OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../core/src/test-utils/context';
import {
  generateEffectValidationSchemaDefinition,
  parseEffectValidationSchemaDefinition,
} from '.';

function makeContext(): ContextSpec {
  return createTestContextSpec();
}

function gen(
  schema: OpenApiSchemaObject,
  options?: { required?: boolean; strict?: boolean },
) {
  const context = makeContext();
  const definition = generateEffectValidationSchemaDefinition(
    schema,
    context,
    'test',
    options?.strict ?? false,
    { required: options?.required ?? true },
  );
  const { effect, consts } = parseEffectValidationSchemaDefinition(
    definition,
    context,
    options?.strict ?? false,
  );
  return { effect, consts };
}

describe('primitives', () => {
  it('emits S.String for type: string', () => {
    expect(gen({ type: 'string' }).effect).toBe('S.String');
  });

  it('emits S.Number for type: number', () => {
    expect(gen({ type: 'number' }).effect).toBe('S.Number');
  });

  it('emits S.Number for type: integer', () => {
    expect(gen({ type: 'integer' }).effect).toBe('S.Number');
  });

  it('emits S.Boolean for type: boolean', () => {
    expect(gen({ type: 'boolean' }).effect).toBe('S.Boolean');
  });
});

describe('constraints', () => {
  it('maps minLength/maxLength on string', () => {
    const { effect } = gen({ type: 'string', minLength: 3, maxLength: 10 });
    expect(effect).toContain('S.String.pipe(');
    expect(effect).toContain('S.minLength(');
    expect(effect).toContain('S.maxLength(');
  });

  it('maps minimum/maximum on number', () => {
    const { effect } = gen({ type: 'number', minimum: 0, maximum: 100 });
    expect(effect).toContain('S.Number.pipe(');
    expect(effect).toContain('S.greaterThanOrEqualTo(');
    expect(effect).toContain('S.lessThanOrEqualTo(');
  });

  it('maps exclusiveMinimum/exclusiveMaximum (3.1 numeric form)', () => {
    const { effect } = gen({
      type: 'number',
      exclusiveMinimum: 0,
      exclusiveMaximum: 100,
    });
    expect(effect).toContain('S.greaterThan(');
    expect(effect).toContain('S.lessThan(');
  });

  it('maps pattern to S.pattern', () => {
    const { effect } = gen({ type: 'string', pattern: '^foo' });
    expect(effect).toContain('S.pattern(');
  });

  it('emits a RegExp pattern literal without useless escapes (#3337)', () => {
    const { consts } = gen({
      type: 'string',
      pattern: String.raw`^(0|[1-9]\d*)$`,
    });
    expect(consts).toContain('RegExp');
    // The `*` quantifier must stay bare — `\*` would trip `no-useless-escape`.
    expect(consts).not.toContain(String.raw`\*`);
    expect(consts).toContain(String.raw`new RegExp('^(0|[1-9]\\d*)$')`);
  });

  it('maps minItems/maxItems on array', () => {
    const { effect } = gen({
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 5,
    });
    expect(effect).toContain('S.Array(S.String)');
    expect(effect).toContain('S.minItems(');
    expect(effect).toContain('S.maxItems(');
  });
});

describe('composites', () => {
  it('emits S.Array for arrays', () => {
    const { effect } = gen({ type: 'array', items: { type: 'number' } });
    expect(effect).toBe('S.Array(S.Number)');
  });

  it('emits S.Struct for objects with properties', () => {
    const { effect } = gen({
      type: 'object',
      properties: { name: { type: 'string' }, age: { type: 'integer' } },
      required: ['name'],
    });
    expect(effect).toContain('S.Struct({');
    expect(effect).toContain('"name": S.String');
    expect(effect).toContain('"age": S.optional(S.Number)');
  });

  it('emits S.Record for additionalProperties', () => {
    const { effect } = gen({
      type: 'object',
      additionalProperties: { type: 'string' },
    });
    expect(effect).toContain('S.Record({ key: S.String, value: S.String })');
  });

  it('emits S.Union for oneOf', () => {
    const { effect } = gen({
      oneOf: [{ type: 'string' }, { type: 'number' }],
    });
    expect(effect).toContain('S.Union(S.String, S.Number)');
  });

  it('emits S.Union for anyOf', () => {
    const { effect } = gen({
      anyOf: [{ type: 'string' }, { type: 'number' }],
    });
    expect(effect).toContain('S.Union(S.String, S.Number)');
  });

  it('emits S.extend for allOf with multiple branches', () => {
    const { effect } = gen({
      allOf: [
        {
          type: 'object',
          properties: { a: { type: 'string' } },
          required: ['a'],
        },
        {
          type: 'object',
          properties: { b: { type: 'number' } },
          required: ['b'],
        },
      ],
    });
    expect(effect).toContain('S.extend(');
  });
});

describe('enums and literals', () => {
  it('emits S.Literal for string enum', () => {
    const { effect } = gen({ type: 'string', enum: ['a', 'b', 'c'] });
    expect(effect).toContain("S.Literal('a', 'b', 'c')");
  });

  it('emits S.Literal for string const', () => {
    const { effect } = gen({
      type: 'string',
      const: 'fixed',
    } as OpenApiSchemaObject);
    expect(effect).toContain('S.Literal("fixed")');
  });

  it('escapes quotes and backslashes in const values', () => {
    const { effect } = gen({
      type: 'string',
      const: String.raw`he"llo\world`,
    } as OpenApiSchemaObject);
    expect(effect).toContain(String.raw`S.Literal("he\"llo\\world")`);
  });
});

describe('nullable and optional', () => {
  it('wraps with S.NullOr when nullable', () => {
    const { effect } = gen({
      type: 'string',
      nullable: true,
    } as OpenApiSchemaObject);
    expect(effect).toContain('S.NullOr(S.String)');
  });

  it('wraps with S.UndefinedOr at top level when optional', () => {
    const { effect } = gen({ type: 'string' }, { required: false });
    expect(effect).toBe('S.UndefinedOr(S.String)');
  });

  it('wraps with S.optional inside Struct property', () => {
    const { effect } = gen({
      type: 'object',
      properties: { name: { type: 'string' } },
      // not required => optional
    });
    expect(effect).toContain('"name": S.optional(S.String)');
  });
});

describe('defaults', () => {
  it('emits S.optionalWith with default inside Struct', () => {
    const { effect, consts } = gen({
      type: 'object',
      properties: { count: { type: 'integer', default: 0 } },
    });
    expect(effect).toContain('S.optionalWith(');
    expect(effect).toContain('default: () =>');
    expect(consts).toContain('testCountDefault');
  });

  it('quotes non-identifier keys in object defaults', () => {
    const { consts } = gen({
      type: 'object',
      properties: {
        config: {
          type: 'object',
          default: { 'foo-bar': 1, 'baz qux': 'hi' },
        } as OpenApiSchemaObject,
      },
    });
    expect(consts).toContain('"foo-bar": 1');
    expect(consts).toContain('"baz qux": "hi" as const');
  });
});

describe('formats', () => {
  it('emits a pattern refinement for email', () => {
    const { effect } = gen({ type: 'string', format: 'email' });
    expect(effect).toContain('S.pattern(');
  });

  it('emits a pattern refinement for uuid', () => {
    const { effect } = gen({ type: 'string', format: 'uuid' });
    expect(effect).toContain('S.pattern(');
  });

  it('emits a pattern refinement for date-time', () => {
    const { effect } = gen({ type: 'string', format: 'date-time' });
    expect(effect).toContain('S.pattern(');
  });

  it('uses S.DateFromString when useDates is enabled', () => {
    const context = createTestContextSpec({
      override: { useDates: true } as ContextSpec['output']['override'],
    });
    const definition = generateEffectValidationSchemaDefinition(
      { type: 'string', format: 'date-time' },
      context,
      'createdAt',
      false,
      { required: true },
    );
    const { effect } = parseEffectValidationSchemaDefinition(
      definition,
      context,
      false,
    );
    expect(effect).toContain('S.DateFromString');
  });
});

describe('description annotation', () => {
  it('appends an annotation when schema has description', () => {
    const { effect } = gen({ type: 'string', description: 'Some field' });
    expect(effect).toContain('.annotations({ description:');
    expect(effect).toContain('Some field');
  });
});

describe('brand', () => {
  it('appends S.brand pipe when brandName is provided', () => {
    const context = makeContext();
    const definition = generateEffectValidationSchemaDefinition(
      { type: 'string' },
      context,
      'userId',
      false,
      { required: true },
    );
    const { effect } = parseEffectValidationSchemaDefinition(
      definition,
      context,
      false,
      'UserId',
    );
    expect(effect).toContain('.pipe(S.brand("UserId"))');
  });
});

describe('enum/const value escaping (#3505)', () => {
  it('JS-escapes backslashes in string enum values', () => {
    const { effect } = gen({
      type: 'string',
      enum: [String.raw`App\Models\Document`, String.raw`App\Models\Template`],
    });
    expect(effect).toContain(
      String.raw`S.Literal('App\\Models\\Document', 'App\\Models\\Template')`,
    );
  });

  it('JS-escapes an enum value ending in a backslash', () => {
    const { effect } = gen({
      type: 'string',
      enum: ['C:\\logs\\', 'C:\\tmp\\'],
    });
    expect(effect).toContain(String.raw`S.Literal('C:\\logs\\', 'C:\\tmp\\')`);
  });

  it('does not escape forward slashes in enum values (#3530)', () => {
    const { effect } = gen({
      type: 'string',
      enum: ['Asia/Tokyo', 'America/New_York'],
    });
    expect(effect).toContain("S.Literal('Asia/Tokyo', 'America/New_York')");
  });

  it('JS-escapes backslashes in string values of object defaults', () => {
    const { consts } = gen({
      type: 'object',
      properties: {
        config: {
          type: 'object',
          default: { path: 'C:\\logs\\' },
        } as OpenApiSchemaObject,
      },
    });
    expect(consts).toContain(String.raw`"path": "C:\\logs\\" as const`);
  });
});

describe('mixed-type enum escaping (#3505 oneOf literal path)', () => {
  it('JS-escapes backslashes in string literals of mixed enums', () => {
    const { effect } = gen({
      type: 'string',
      enum: ['C:\\logs\\', 1],
    } as OpenApiSchemaObject);
    expect(effect).toContain(String.raw`S.Literal('C:\\logs\\')`);
    expect(effect).toContain('S.Literal(1)');
  });
});
