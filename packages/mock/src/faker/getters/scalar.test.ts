import { describe, it, expect } from 'vitest';
import { getMockScalar } from './scalar';
import type { ContextSpecs } from '@orval/core';
import type { SchemaObjectType } from 'openapi3-ts/oas30';

describe('getMockScalar (int64 format handling)', () => {
  const baseArg = {
    item: {
      type: 'integer' as SchemaObjectType,
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

describe('getMockScalar (uint64 format handling)', () => {
  const baseArg = {
    item: {
      type: 'integer' as SchemaObjectType,
      format: 'uint64',
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

  it('should return faker.number.bigInt() when format is uint64, useBigInt is true, and mockOptions.format.uint64 is NOT specified', () => {
    const result = getMockScalar({
      ...baseArg,
      context: { output: { override: { useBigInt: true } } } as ContextSpecs,
    });

    expect(result.value).toBe('faker.number.bigInt({min: 1, max: 100})');
  });

  it('should return faker.number.int() when format is uint64, useBigInt is false, and mockOptions.format.uint64 is NOT specified', () => {
    const result = getMockScalar({
      ...baseArg,
      context: { output: { override: { useBigInt: false } } } as ContextSpecs,
    });

    expect(result.value).toBe('faker.number.int({min: 1, max: 100})');
  });

  it('should return custom mockOptions.format.uint64 when format is uint64 and mockOptions.format.uint64 IS specified', () => {
    const specified = 'faker.number.int({ min: 0, max: 200 }).toString()';

    const result = getMockScalar({
      ...baseArg,
      mockOptions: {
        format: {
          uint64: specified,
        },
      },
      context: { output: { override: { useBigInt: true } } } as ContextSpecs,
    });

    expect(result.value).toBe(specified);
  });
});

describe('getMockScalar (example handling with falsy values)', () => {
  const baseArg = {
    item: {
      name: 'test-item',
      example: false,
      type: 'boolean' as const,
    },
    imports: [],
    operationId: 'test-operation',
    tags: [],
    existingReferencedProperties: [],
    splitMockImplementations: [],
    mockOptions: { useExamples: true },
    context: { output: {} } as ContextSpecs,
  };

  it('should return the example value when it is a false value', () => {
    const result = getMockScalar({
      ...baseArg,
      item: { ...baseArg.item, example: false },
    });

    expect(result.value).toBe('false');
  });

  it('should return the example value when it is a null value', () => {
    const result = getMockScalar({
      ...baseArg,
      item: { ...baseArg.item, example: null },
    });

    expect(result.value).toBe('null');
  });

  it('should return a faker invocation when the example is undefined', () => {
    const result = getMockScalar({
      ...baseArg,
      item: { ...baseArg.item, example: undefined },
    });

    expect(result.value).toBe('faker.datatype.boolean()');
  });
});
