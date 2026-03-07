import type { ContextSpec } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../../core/src/test-utils/context';
import { getMockObject } from './object';

describe('getMockObject', () => {
  const context: ContextSpec = createTestContextSpec();

  it('preserves object properties when a schema type array includes object', () => {
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

    expect(result.value).toContain('faker.helpers.arrayElement');
    expect(result.value).toContain('id:');
    expect(result.value).toContain('faker.string.alpha()');
    expect(result.value).toContain('null');
  });
});
