import type { ContextSpec } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../../core/src/test-utils/context';
import { getMockObject } from './object';

describe('getMockObject', () => {
  const context: ContextSpec = createTestContextSpec();

  it('generates object properties for nullable object type arrays (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
        properties: {
          id: {
            type: 'string',
          },
        },
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe(
      'faker.helpers.arrayElement([{id: faker.helpers.arrayElement([faker.string.alpha(), undefined])},null,])',
    );
  });

  it('generates object properties for nullable object with required fields (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
        properties: {
          id: {
            type: 'string',
          },
          name: {
            type: 'string',
          },
        },
        required: ['id'],
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe(
      'faker.helpers.arrayElement([{id: faker.string.alpha(), name: faker.helpers.arrayElement([faker.string.alpha(), undefined])},null,])',
    );
  });

  it('returns empty object variant when nullable object has no properties (OpenAPI 3.1)', () => {
    const result = getMockObject({
      item: {
        name: 'nullableObject',
        type: ['object', 'null'],
      },
      operationId: 'getNullableObject',
      tags: [],
      context,
      imports: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
    });

    expect(result.value).toBe('faker.helpers.arrayElement([null,])');
  });
});
