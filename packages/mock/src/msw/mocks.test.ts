import type { ResReqTypesValue } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../../core/src/test-utils/context';
import { getResponsesMockDefinition } from './mocks';

describe('getResponsesMockDefinition (useExamples + transformer)', () => {
  const petResponse: ResReqTypesValue = {
    key: '200',
    value: 'Pet',
    contentType: 'application/json',
    originalSchema: {
      type: 'object',
      properties: {
        createdAt: { type: 'string', format: 'date-time' },
        birthDate: { type: 'string', format: 'date' },
      },
    },
    examples: {
      default: {
        value: {
          createdAt: '2023-12-31T06:46:39.477Z',
          birthDate: '2023-12-31',
        },
      },
    },
    imports: [],
    schemas: [],
    type: 'object',
    isEnum: false,
    isRef: false,
    hasReadonlyProps: false,
  };

  const baseOptions = {
    operationId: 'getPet',
    tags: [],
    returnType: 'Pet',
    responses: [petResponse],
    mockOptionsWithoutFunc: {},
    context: createTestContextSpec({
      override: { useDates: true, mock: { useExamples: true } },
    }),
    splitMockImplementations: [],
  };

  it('formats date examples before passing them to transformer', () => {
    const { definitions } = getResponsesMockDefinition({
      ...baseOptions,
      transformer: (value) => `wrap(${String(value)})`,
    });

    expect(definitions[0]).toBe(
      'wrap({ createdAt: new Date("2023-12-31T06:46:39.477Z"), birthDate: new Date("2023-12-31") })',
    );
  });
});
