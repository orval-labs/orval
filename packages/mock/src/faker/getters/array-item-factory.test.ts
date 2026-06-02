import { type ContextSpec, OutputMode } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  extractArrayItemMock,
  getArrayItemMockFileScope,
  shouldExtractArrayItemFactories,
} from './array-item-factory';

const createContextWithArrayItems = (
  mode: OutputMode = OutputMode.SINGLE,
): ContextSpec =>
  ({
    output: {
      mode,
      mock: {
        generators: [{ type: 'faker', arrayItems: true }],
      },
      override: {
        components: { schemas: { suffix: '', itemSuffix: 'Item' } },
      },
    },
    spec: {
      openapi: '3.0.3',
      components: {
        schemas: {
          TenantResponseModelDto: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
          },
        },
      },
    },
  }) as unknown as ContextSpec;

const contextWithoutArrayItems = {
  output: {
    mock: {
      generators: [{ type: 'faker' }],
    },
    override: {
      components: { schemas: { suffix: '', itemSuffix: 'Item' } },
    },
  },
} as unknown as ContextSpec;

const mapValue =
  '{id: faker.string.uuid(), name: faker.string.alpha({length: {min: 10, max: 20}})}';

describe('getArrayItemMockFileScope', () => {
  it('uses a single scope for single mode', () => {
    const context = createContextWithArrayItems();
    expect(getArrayItemMockFileScope(context, ['pets'])).toBe('single');
  });

  it('uses per-tag scope for tags-split mode', () => {
    const context = createContextWithArrayItems(OutputMode.TAGS_SPLIT);
    expect(getArrayItemMockFileScope(context, ['alpha'])).toBe('tag:alpha');
    expect(getArrayItemMockFileScope(context, ['beta'])).toBe('tag:beta');
  });
});

describe('shouldExtractArrayItemFactories', () => {
  it('returns true when arrayItems is enabled', () => {
    expect(shouldExtractArrayItemFactories(createContextWithArrayItems())).toBe(
      true,
    );
  });

  it('returns false when arrayItems is not enabled', () => {
    expect(shouldExtractArrayItemFactories(contextWithoutArrayItems)).toBe(
      false,
    );
  });
});

describe('extractArrayItemMock', () => {
  it('extracts a reusable factory for $ref array items', () => {
    const splitMockImplementations: string[] = [];
    const imports: Parameters<typeof extractArrayItemMock>[0]['imports'] = [];

    const call = extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getTenantsByRef',
      tags: [],
      mapValue,
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports,
    });

    expect(call).toBe('{...getTenantResponseModelDtoMock()}');
    expect(splitMockImplementations).toHaveLength(1);
    expect(splitMockImplementations[0]).toContain(
      'export const getTenantResponseModelDtoMock',
    );
    expect(splitMockImplementations[0]).toContain(
      'Partial<TenantResponseModelDto>',
    );
    expect(imports).toEqual([{ name: 'TenantResponseModelDto' }]);
  });

  it('extracts a reusable factory for inline object array items', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
        },
      },
      propertyName: 'value',
      parentName: 'GetTenants200',
      operationId: 'getTenants',
      tags: [],
      mapValue,
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBe('{...getGetTenantsResponseValueItemMock()}');
    expect(splitMockImplementations[0]).toContain(
      'export const getGetTenantsResponseValueItemMock',
    );
    expect(splitMockImplementations[0]).toContain(
      'Partial<GetTenants200ValueItem>',
    );
  });

  it('deduplicates factories with the same name within one operation', () => {
    const context = createContextWithArrayItems();
    const splitMockImplementations: string[] = [];

    extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getTenantsByRef',
      tags: [],
      mapValue,
      context,
      splitMockImplementations,
      imports: [],
    });
    extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'items',
      operationId: 'getTenantsByRef',
      tags: [],
      mapValue,
      context,
      splitMockImplementations,
      imports: [],
    });

    expect(splitMockImplementations).toHaveLength(1);
  });

  it('deduplicates $ref factories across operations in the same output file', () => {
    const context = createContextWithArrayItems();
    const splitMockImplementationsA: string[] = [];
    const splitMockImplementationsB: string[] = [];

    extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getTenantsA',
      tags: [],
      mapValue,
      context,
      splitMockImplementations: splitMockImplementationsA,
      imports: [],
    });
    extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getTenantsB',
      tags: [],
      mapValue,
      context,
      splitMockImplementations: splitMockImplementationsB,
      imports: [],
    });

    expect(splitMockImplementationsA).toHaveLength(1);
    expect(splitMockImplementationsB).toHaveLength(0);
    expect(
      context.arrayItemMockFactories
        ?.get('single')
        ?.has('getTenantResponseModelDtoMock'),
    ).toBe(true);
  });

  it('emits $ref factories separately per tag in tags-split mode', () => {
    const context = createContextWithArrayItems(OutputMode.TAGS_SPLIT);
    const splitMockImplementationsAlpha: string[] = [];
    const splitMockImplementationsBeta: string[] = [];

    extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getA',
      tags: ['alpha'],
      mapValue,
      context,
      splitMockImplementations: splitMockImplementationsAlpha,
      imports: [],
    });
    extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getB',
      tags: ['beta'],
      mapValue,
      context,
      splitMockImplementations: splitMockImplementationsBeta,
      imports: [],
    });

    expect(splitMockImplementationsAlpha).toHaveLength(1);
    expect(splitMockImplementationsBeta).toHaveLength(1);
    expect(
      context.arrayItemMockFactories
        ?.get('tag:alpha')
        ?.has('getTenantResponseModelDtoMock'),
    ).toBe(true);
    expect(
      context.arrayItemMockFactories
        ?.get('tag:beta')
        ?.has('getTenantResponseModelDtoMock'),
    ).toBe(true);
  });

  it('skips primitive array items', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: { type: 'string' },
      propertyName: 'tags',
      operationId: 'getTenants',
      tags: [],
      mapValue: 'faker.string.alpha({length: {min: 10, max: 20}})',
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBeUndefined();
    expect(splitMockImplementations).toHaveLength(0);
  });

  it('skips when the value already delegates to a factory', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getTenantsByRef',
      tags: [],
      mapValue: '{...getTenantResponseModelDtoMock()}',
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBeUndefined();
    expect(splitMockImplementations).toHaveLength(0);
  });

  it('does not treat nested factory calls as already delegating', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          pet: { $ref: '#/components/schemas/Pet' },
        },
      },
      propertyName: 'value',
      parentName: 'GetTenants200',
      operationId: 'getTenants',
      tags: [],
      mapValue:
        '{id: faker.string.uuid(), pet: {...getPetMock()}, name: faker.string.alpha({length: {min: 10, max: 20}})}',
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBe('{...getGetTenantsResponseValueItemMock()}');
    expect(splitMockImplementations).toHaveLength(1);
  });

  it('skips $ref array items that resolve to scalar schemas', () => {
    const splitMockImplementations: string[] = [];
    const context = {
      ...createContextWithArrayItems(),
      spec: {
        components: {
          schemas: {
            Name: { type: 'string', format: 'email' },
          },
        },
      },
    } as unknown as ContextSpec;

    const call = extractArrayItemMock({
      items: { $ref: '#/components/schemas/Name' },
      propertyName: 'names',
      operationId: 'getNames',
      tags: [],
      mapValue: 'faker.internet.email()',
      context,
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBeUndefined();
    expect(splitMockImplementations).toHaveLength(0);
  });

  it('skips oneOf array items', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: {
        oneOf: [
          { $ref: '#/components/schemas/Cat' },
          { $ref: '#/components/schemas/Dog' },
        ],
      },
      propertyName: 'things',
      operationId: 'getThings',
      tags: [],
      mapValue: '{meow: faker.datatype.boolean()}',
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBeUndefined();
    expect(splitMockImplementations).toHaveLength(0);
  });

  it('skips nullable object array items', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: {
        type: 'object',
        nullable: true,
        properties: { id: { type: 'string' } },
      },
      propertyName: 'rows',
      operationId: 'getNullable',
      tags: [],
      mapValue: '{id: faker.string.uuid()}',
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBeUndefined();
    expect(splitMockImplementations).toHaveLength(0);
  });

  it('skips nested inline array items when parentName is not the response wrapper', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: {
        type: 'object',
        properties: { a: { type: 'string' } },
      },
      propertyName: 'items',
      parentName: 'outer',
      operationId: 'getCollide',
      tags: [],
      mapValue: '{a: faker.string.alpha({length: {min: 10, max: 20}})}',
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBeUndefined();
    expect(splitMockImplementations).toHaveLength(0);
  });

  it('still extracts inline allOf object array items', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: {
        allOf: [
          {
            type: 'object',
            properties: { id: { type: 'string' } },
          },
        ],
      },
      propertyName: 'value',
      parentName: 'GetTenants200',
      operationId: 'getTenants',
      tags: [],
      mapValue: '{id: faker.string.uuid()}',
      context: createContextWithArrayItems(),
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBe('{...getGetTenantsResponseValueItemMock()}');
    expect(splitMockImplementations).toHaveLength(1);
  });

  it('skips $ref components/schemas items when schemas: true emits consolidated factories', () => {
    const splitMockImplementations: string[] = [];
    const contextWithSchemas = {
      output: {
        schemas: './model',
        mock: {
          generators: [{ type: 'faker', arrayItems: true, schemas: true }],
        },
        override: {
          components: { schemas: { suffix: '', itemSuffix: 'Item' } },
        },
      },
    } as unknown as ContextSpec;

    const call = extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getTenantsByRef',
      tags: [],
      mapValue,
      context: contextWithSchemas,
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBeUndefined();
    expect(splitMockImplementations).toHaveLength(0);
  });
});
