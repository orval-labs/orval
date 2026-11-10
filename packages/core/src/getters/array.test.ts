import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiSchemaObject } from '../types';
import { getArray } from './array';

describe('getArray', () => {
  const context = createTestContextSpec({
    override: {
      components: {
        schemas: { prefix: '', itemPrefix: '', suffix: '', itemSuffix: 'Item' },
        responses: { prefix: '', suffix: '' },
        parameters: { prefix: '', suffix: '' },
        requestBodies: { prefix: '', suffix: '' },
      },
    },
  });

  it('should inline types when name is undefined (no schemas generated)', () => {
    // When name is undefined, types should be inlined, not declared as schemas.
    // Previously `undefined + "Item"` became "undefinedItem" via JS coercion.
    const schema: OpenApiSchemaObject = {
      type: 'array',
      prefixItems: [
        { type: 'string' },
        { type: 'object', properties: { id: { type: 'number' } } },
      ],
    };

    const result = getArray({
      schema,
      name: undefined,
      context,
    });

    // No schemas generated - types are inlined
    expect(result.schemas).toHaveLength(0);
  });

  it('should wrap intersection type in parens when items use allOf with $refs', () => {
    const contextWithSchemas = createTestContextSpec({
      spec: {
        components: {
          schemas: {
            PartOne: {
              type: 'object',
              properties: { id: { type: 'integer' } },
              required: ['id'],
            },
            PartTwo: {
              type: 'object',
              properties: { name: { type: 'string' } },
              required: ['name'],
            },
          },
        },
      },
    });

    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: {
        allOf: [
          { $ref: '#/components/schemas/PartOne' },
          { $ref: '#/components/schemas/PartTwo' },
        ],
      },
    };

    const result = getArray({
      schema,
      name: 'MyArray',
      context: contextWithSchemas,
    });

    expect(result.value).toEqual('(PartOne & PartTwo)[]');
  });

  it('should generate named schemas when name is provided', () => {
    const schema: OpenApiSchemaObject = {
      type: 'array',
      prefixItems: [
        { type: 'string' },
        { type: 'object', properties: { id: { type: 'number' } } },
      ],
    };

    const result = getArray({
      schema,
      name: 'MyTuple',
      context,
    });

    expect(result.schemas).toHaveLength(1);
    expect(result.schemas[0].name).toBe('MyTupleItem1');
  });

  it.each([undefined, false, true])(
    'emits array types with useReadonlyArrays=%s',
    (useReadonlyArrays) => {
      const testContext = createTestContextSpec({
        override: { useReadonlyArrays, suppressReadonlyModifier: true },
      });
      const result = getArray({
        schema: { type: 'array', readOnly: true, items: { type: 'string' } },
        context: testContext,
      });
      expect(result.value).toBe(
        useReadonlyArrays ? 'readonly string[]' : 'string[]',
      );
      expect(result.hasReadonlyProps).toBe(false);
    },
  );

  it('preserves existing OpenAPI readOnly handling when the option is absent', () => {
    expect(
      getArray({
        schema: { type: 'array', readOnly: true, items: { type: 'string' } },
        context,
      }).value,
    ).toBe('readonly string[]');
  });

  it('preserves the existing nested readOnly array output by default', () => {
    expect(
      getArray({
        schema: {
          type: 'array',
          items: { type: 'array', readOnly: true, items: { type: 'string' } },
        },
        context,
      }).value,
    ).toBe('readonly string[][]');
  });

  it('parenthesizes nested readonly, nullable, union, and intersection items', () => {
    const testContext = createTestContextSpec({
      override: { useReadonlyArrays: true },
      spec: {
        components: {
          schemas: {
            First: { type: 'object', properties: { id: { type: 'string' } } },
            Second: {
              type: 'object',
              properties: { name: { type: 'string' } },
            },
          },
        },
      },
    });
    const arrayOf = (items: OpenApiSchemaObject) =>
      getArray({ schema: { type: 'array', items }, context: testContext })
        .value;

    expect(arrayOf({ type: 'array', items: { type: 'string' } })).toBe(
      'readonly (readonly string[])[]',
    );
    expect(arrayOf({ type: ['string', 'null'] })).toBe(
      'readonly (string | null)[]',
    );
    expect(arrayOf({ oneOf: [{ type: 'string' }, { type: 'number' }] })).toBe(
      'readonly (string | number)[]',
    );
    expect(
      arrayOf({
        allOf: [
          { $ref: '#/components/schemas/First' },
          { $ref: '#/components/schemas/Second' },
        ],
      }),
    ).toBe('readonly (First & Second)[]');
  });

  it('emits readonly tuples with nested array items and a union rest', () => {
    const testContext = createTestContextSpec({
      override: { useReadonlyArrays: true },
    });
    expect(
      getArray({
        schema: {
          type: 'array',
          prefixItems: [{ type: 'array', items: { type: 'string' } }],
          items: { oneOf: [{ type: 'string' }, { type: 'number' }] },
        },
        context: testContext,
      }).value,
    ).toBe('readonly [readonly string[], ...(string | number)[]]');
    expect(
      getArray({
        schema: {
          type: 'array',
          prefixItems: [{ type: 'string' }],
          items: { type: 'array', items: { type: 'number' } },
        },
        context: testContext,
      }).value,
    ).toBe('readonly [string, ...(readonly number[])[]]');
  });

  it('emits readonly unknown arrays for untyped OpenAPI 3.1 arrays', () => {
    const testContext = createTestContextSpec({
      override: { useReadonlyArrays: true },
      spec: { openapi: '3.1.0' },
    });
    expect(
      getArray({ schema: { type: 'array' }, context: testContext }).value,
    ).toBe('readonly unknown[]');
  });
});
