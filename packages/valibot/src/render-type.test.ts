import type { OpenApiSchemaObject } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import { renderValibotType } from './render-type';
import { generateValibotValidationSchemaDefinition } from './schema';

const typesOf = (
  schema: OpenApiSchemaObject,
  { exactOptional = false, useDates = false, decode = 'toId' } = {},
) => {
  const context = createTestContextSpec({
    output: {
      override: {
        useDates,
        formatType: { uuid: { type: 'Id', decode } },
      },
    },
  });
  const node = generateValibotValidationSchemaDefinition(
    schema,
    context,
    false,
    { required: true },
  );
  const render = (direction: 'input' | 'output') =>
    renderValibotType(node, { direction, exactOptional, declared: new Map() });
  return { input: render('input'), output: render('output') };
};

const object: OpenApiSchemaObject = {
  type: 'object',
  required: ['tags'],
  properties: {
    tags: { type: 'array', readOnly: true, items: { type: 'string' } },
    note: { type: ['string', 'null'] },
    score: { type: 'number', default: 0 },
  },
};

describe('renderValibotType', () => {
  it('types optional, nullish, defaulted and readonly keys', () => {
    expect(typesOf(object)).toEqual({
      input:
        '{\n  tags: string[];\n  note?: string | null | undefined;\n  score?: number | undefined;\n}',
      output:
        '{\n  readonly tags: readonly string[];\n  note?: string | null | undefined;\n  score: number;\n}',
    });
  });

  it('leaves undefined out of optional keys with exactOptional', () => {
    expect(typesOf(object, { exactOptional: true }).input).toBe(
      '{\n  tags: string[];\n  note?: string | null;\n  score?: number;\n}',
    );
  });

  it('types the output of a transform', () => {
    const at = { type: 'string', format: 'date-time' } as const;
    expect(typesOf({ type: 'array', items: at }, { useDates: true })).toEqual({
      input: 'string[]',
      output: 'Date[]',
    });
    expect(typesOf({ type: 'string', format: 'uuid' }).output).toBe(
      'ReturnType<typeof toId>',
    );
    // The type of an inline decode is left to the caller.
    expect(
      typesOf({ type: 'string', format: 'uuid' }, { decode: '(s) => s' })
        .output,
    ).toBe('unknown');
    // The date transform is left out of an intersection member.
    expect(
      typesOf({ allOf: [at, { type: 'string' }] }, { useDates: true }).output,
    ).toBe('string & string');
  });

  it('marks the key or record that holds a readonly pipe readonly', () => {
    const tags = { type: 'array', readOnly: true, items: { type: 'string' } };
    expect(
      typesOf({
        type: 'object',
        required: ['tags'],
        properties: { tags: { allOf: [tags] } },
      } as OpenApiSchemaObject).output,
    ).toBe('{\n  readonly tags: readonly string[];\n}');
    expect(
      typesOf({
        type: 'object',
        additionalProperties: tags,
      } as OpenApiSchemaObject).output,
    ).toBe('{ readonly [key: string]: readonly string[] }');
  });

  it('types records and open objects', () => {
    expect(
      typesOf({ type: 'object', additionalProperties: { type: 'number' } })
        .output,
    ).toBe('{ [key: string]: number }');
    expect(
      typesOf({
        type: 'object',
        additionalProperties: true,
        properties: { id: { type: 'string' } },
      }).output,
    ).toBe('{\n  id?: string | undefined;\n} & { [key: string]: unknown }');
  });

  it('groups a union inside an array or intersection', () => {
    expect(
      typesOf({ type: 'array', items: { type: ['string', 'number'] } }).output,
    ).toBe('(string | number)[]');
    expect(
      typesOf({
        allOf: [{ type: ['string', 'number'] }, { type: 'string' }],
      }).output,
    ).toBe('(string | number) & string');
  });
});
