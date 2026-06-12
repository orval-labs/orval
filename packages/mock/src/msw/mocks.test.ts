import type { ResReqTypesValue } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../core/src/test-utils/context';
import { getResponsesMockDefinition } from './mocks';

describe('getResponsesMockDefinition', () => {
  it('aggregates imports when response.imports is undefined (#3590)', () => {
    const context = createTestContextSpec();

    const result = getResponsesMockDefinition({
      operationId: 'getPetPhoto',
      tags: ['Pets'],
      returnType: 'Blob',
      responses: [
        {
          value: 'Blob',
          originalSchema: { type: 'string', format: 'binary' },
          contentType: 'application/octet-stream',
          imports: undefined,
          isRef: false,
        } as unknown as ResReqTypesValue,
      ],
      mockOptionsWithoutFunc: {},
      context,
      splitMockImplementations: [],
    });

    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]).toContain('ArrayBuffer');
    expect(result.imports.length).toBeGreaterThanOrEqual(0);
  });
});
