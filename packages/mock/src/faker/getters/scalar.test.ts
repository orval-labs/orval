import { describe, it, expect } from 'vitest';
import { getMockScalar } from './scalar';
import { ContextSpecs } from '@orval/core';

describe('getMockScalar (int64 format handling)', () => {
  const baseArg = {
    item: {
      format: 'int64',
      minimum: 1,
      maximum: 100,
      name: 'test-item',
    },
    imports: [],
    operationId: 'test-operation',
    tags: [],
    existingReferencedProperties: [],
    splitMockImplementations: [],
  };

  it('should return faker.number.bigInt() when format is int64, useBigInt is true, and mockOptions.format.int64 is NOT specified', () => {
    const result = getMockScalar({
      ...baseArg,
      context: { output: { override: { useBigInt: true } } } as ContextSpecs,
    });

    expect(result.value).toBe('faker.number.bigInt({min: 1, max: 100})');
  });

  it('should return faker.number.int() when format is int64, useBigInt is false, and mockOptions.format.int64 is NOT specified', () => {
    const result = getMockScalar({
      ...baseArg,
      context: { output: { override: { useBigInt: false } } } as ContextSpecs,
    });

    expect(result.value).toBe('faker.number.int({min: 1, max: 100})');
  });

  it('should return custom mockOptions.format.int64 when format is int64 and mockOptions.format.int64 IS specified', () => {
    const specified = 'faker.number.int({ min: 0, max: 200 }).toString()';

    const result = getMockScalar({
      ...baseArg,
      mockOptions: {
        format: {
          int64: specified,
        },
      },
      context: { output: { override: { useBigInt: true } } } as ContextSpecs,
    });

    expect(result.value).toBe(specified);
  });
});
