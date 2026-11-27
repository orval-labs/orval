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

  describe('useArrayLengthTuples', () => {
    const schema: OpenApiSchemaObject = {
      type: 'array',
      items: { type: 'string' },
      minItems: 1,
      maxItems: 3,
    };
    const enabled = createTestContextSpec({
      override: { useArrayLengthTuples: true },
    });

    it('emits one tuple for each length in the inclusive range', () => {
      expect(getArray({ schema, context: enabled }).value).toBe(
        '[string] | [string, string] | [string, string, string]',
      );
    });

    it('keeps the array type by default and when explicitly disabled', () => {
      expect(getArray({ schema, context }).value).toBe('string[]');
      expect(
        getArray({
          schema,
          context: createTestContextSpec({
            override: { useArrayLengthTuples: false },
          }),
        }).value,
      ).toBe('string[]');
    });

    it('uses zero for an omitted minimum and supports an empty tuple', () => {
      expect(
        getArray({
          schema: { ...schema, minItems: undefined, maxItems: 2 },
          context: enabled,
        }).value,
      ).toBe('[] | [string] | [string, string]');
      expect(
        getArray({
          schema: { ...schema, minItems: 0, maxItems: 0 },
          context: enabled,
        }).value,
      ).toBe('[]');
    });

    it('includes the supported upper boundary for a fixed length', () => {
      expect(
        getArray({
          schema: { ...schema, minItems: 8, maxItems: 8 },
          context: enabled,
        }).value,
      ).toBe(
        '[string, string, string, string, string, string, string, string]',
      );
    });

    it.each([
      [1, undefined],
      [1, 9],
      [1, Number.POSITIVE_INFINITY],
      [1, 2.5],
      [0.5, 2],
      [-1, 2],
      [0, -1],
      [2, 1],
    ])('keeps an array for unsupported bounds %s..%s', (minItems, maxItems) => {
      expect(
        getArray({
          schema: { ...schema, minItems, maxItems },
          context: enabled,
        }).value,
      ).toBe('string[]');
    });

    it('keeps the existing prefixItems path', () => {
      expect(
        getArray({
          schema: {
            ...schema,
            prefixItems: [{ type: 'boolean' }],
          },
          context: enabled,
        }).value,
      ).toBe('[boolean, ...string[]]');
    });

    it.each([
      [true, false, false, 'readonly '],
      [true, true, false, ''],
      [false, false, true, 'readonly '],
    ])(
      'preserves readOnly=%s, suppressReadonlyModifier=%s and useReadonlyArrays=%s',
      (readOnly, suppressReadonlyModifier, useReadonlyArrays, prefix) => {
        expect(
          getArray({
            schema: { ...schema, readOnly, maxItems: 2 },
            context: createTestContextSpec({
              override: {
                useArrayLengthTuples: true,
                suppressReadonlyModifier,
                useReadonlyArrays,
              },
            }),
          }).value,
        ).toBe(`${prefix}[string] | ${prefix}[string, string]`);
      },
    );

    it('keeps a readonly tuple as the element of a mutable array', () => {
      expect(
        getArray({
          schema: {
            type: 'array',
            items: { ...schema, minItems: 1, maxItems: 1, readOnly: true },
          },
          context: enabled,
        }).value,
      ).toBe('(readonly [string])[]');
    });

    it('groups a new tuple union when it is used as a rest element', () => {
      expect(
        getArray({
          schema: {
            type: 'array',
            prefixItems: [{ type: 'boolean' }],
            items: { ...schema, maxItems: 2 },
          },
          context: enabled,
        }).value,
      ).toBe('[boolean, ...([string] | [string, string])[]]');
    });

    it('does not repeatedly expand a large inline tuple union', () => {
      const inner = { ...schema, minItems: 0, maxItems: 8 };
      const nested = getArray({
        schema: { ...inner, items: inner },
        context: enabled,
      }).value;
      expect(nested).toBe(
        `(${getArray({ schema: inner, context: enabled }).value})[]`,
      );
    });

    it('resolves a referenced item once for all lengths', () => {
      const items = { $ref: '#/components/schemas/Item' };
      const spec = {
        components: { schemas: { Item: { type: 'string' } } },
      } as const;
      const config = createTestContextSpec({ spec });
      const boundedSchema = { ...schema, items };
      const original = getArray({ schema: boundedSchema, context: config });
      const result = getArray({
        schema: boundedSchema,
        context: createTestContextSpec({
          spec,
          override: { useArrayLengthTuples: true },
        }),
      });
      expect(result.value).toBe('[Item] | [Item, Item] | [Item, Item, Item]');
      expect(result.imports).toEqual(original.imports);
      expect(result.dependencies).toEqual(original.dependencies);
      expect(result.schemas).toEqual(original.schemas);
    });
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
