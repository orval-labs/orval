import type { ResReqTypesValue } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../core/src/test-utils/context';
import { getResponsesMockDefinition } from './mocks';

describe('getResponsesMockDefinition', () => {
  it('aggregates imports when response.imports is undefined (#3590)', () => {
    const context = createTestContextSpec();

    const splitImplementation = [
      'export const getExampleResponsePointInFutureAbsoluteMock = (',
      '  overrideResponse: Partial<PointInFutureAbsolute> = {},',
      '): PointInFutureAbsolute => ({ kind: "absolute" });',
    ].join('\n');

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
      splitMockImplementations: [splitImplementation],
    });

    expect(result.definitions).toHaveLength(1);
    expect(result.definitions[0]).toContain('ArrayBuffer');
    expect(result.imports).toEqual([
      { name: 'PointInFutureAbsolute', values: false },
    ]);
  });
});
