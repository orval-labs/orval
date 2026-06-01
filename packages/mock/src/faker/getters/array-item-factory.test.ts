import type { ContextSpec } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  extractArrayItemMock,
  shouldExtractArrayItemFactories,
} from './array-item-factory';

const contextWithArrayItems = {
  output: {
    mock: {
      generators: [{ type: 'faker', arrayItems: true }],
    },
    override: {
      components: { schemas: { suffix: '', itemSuffix: 'Item' } },
    },
  },
} as unknown as ContextSpec;

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

describe('shouldExtractArrayItemFactories', () => {
  it('returns true when arrayItems is enabled', () => {
    expect(shouldExtractArrayItemFactories(contextWithArrayItems)).toBe(true);
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
      mapValue:
        '{id: faker.string.uuid(), name: faker.string.alpha({length: {min: 10, max: 20}})}',
      context: contextWithArrayItems,
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
      mapValue:
        '{id: faker.string.uuid(), name: faker.string.alpha({length: {min: 10, max: 20}})}',
      context: contextWithArrayItems,
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

  it('deduplicates factories with the same name', () => {
    const splitMockImplementations: string[] = [];
    const mapValue =
      '{id: faker.string.uuid(), name: faker.string.alpha({length: {min: 10, max: 20}})}';

    extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'value',
      operationId: 'getTenantsByRef',
      mapValue,
      context: contextWithArrayItems,
      splitMockImplementations,
      imports: [],
    });
    extractArrayItemMock({
      items: { $ref: '#/components/schemas/TenantResponseModelDto' },
      propertyName: 'items',
      operationId: 'getTenantsByRef',
      mapValue,
      context: contextWithArrayItems,
      splitMockImplementations,
      imports: [],
    });

    expect(splitMockImplementations).toHaveLength(1);
  });

  it('skips primitive array items', () => {
    const splitMockImplementations: string[] = [];

    const call = extractArrayItemMock({
      items: { type: 'string' },
      propertyName: 'tags',
      operationId: 'getTenants',
      mapValue: 'faker.string.alpha({length: {min: 10, max: 20}})',
      context: contextWithArrayItems,
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
      mapValue: '{...getTenantResponseModelDtoMock()}',
      context: contextWithArrayItems,
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
      mapValue:
        '{id: faker.string.uuid(), pet: {...getPetMock()}, name: faker.string.alpha({length: {min: 10, max: 20}})}',
      context: contextWithArrayItems,
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
      mapValue:
        '{id: faker.string.uuid(), name: faker.string.alpha({length: {min: 10, max: 20}})}',
      context: contextWithSchemas,
      splitMockImplementations,
      imports: [],
    });

    expect(call).toBeUndefined();
    expect(splitMockImplementations).toHaveLength(0);
  });
});
