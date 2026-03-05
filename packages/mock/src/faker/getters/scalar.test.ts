/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable unicorn/no-null */
import type { ContextSpec, OpenApiSchemaObjectType } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { getMockScalar } from './scalar';

describe('getMockScalar (int64 format handling)', () => {
  const baseArg = {
    item: {
      type: 'integer' as OpenApiSchemaObjectType,
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
      context: { output: { override: { useBigInt: true } } } as ContextSpec,
    });

    expect(result.value).toBe('faker.number.bigInt({min: 1, max: 100})');
  });

  it('should return faker.number.int() when format is int64, useBigInt is false, and mockOptions.format.int64 is NOT specified', () => {
    const result = getMockScalar({
      ...baseArg,
      context: { output: { override: { useBigInt: false } } } as ContextSpec,
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
      context: { output: { override: { useBigInt: true } } } as ContextSpec,
    });

    expect(result.value).toBe(specified);
  });
});

describe('getMockScalar (uint64 format handling)', () => {
  const baseArg = {
    item: {
      type: 'integer' as OpenApiSchemaObjectType,
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
      context: { output: { override: { useBigInt: true } } } as ContextSpec,
    });

    expect(result.value).toBe('faker.number.bigInt({min: 1, max: 100})');
  });

  it('should return faker.number.int() when format is uint64, useBigInt is false, and mockOptions.format.uint64 is NOT specified', () => {
    const result = getMockScalar({
      ...baseArg,
      context: { output: { override: { useBigInt: false } } } as ContextSpec,
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
      context: { output: { override: { useBigInt: true } } } as ContextSpec,
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
    context: { output: { override: {} } } as ContextSpec, // TODO this should be: satisfies ContextSpec
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

describe('getMockScalar (multipleOf handling)', () => {
  const createContext = (
    packageJsonDeps?: Record<string, string>,
  ): ContextSpec => {
    const context = {
      output: {
        override: {},
        ...(packageJsonDeps && {
          packageJson: { dependencies: packageJsonDeps },
        }),
      },
    } as ContextSpec;
    return context;
  };

  const baseArg = {
    imports: [],
    operationId: 'test-operation',
    tags: [],
    existingReferencedProperties: [],
    splitMockImplementations: [],
  };

  it('should include multipleOf when defined for integer type with Faker v9', () => {
    const integerType: OpenApiSchemaObjectType = 'integer';
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: integerType,
        minimum: 0,
        maximum: 100,
        multipleOf: 5,
        name: 'test-item',
      },
      context: createContext({ '@faker-js/faker': '^9.0.0' }),
    });

    expect(result.value).toBe(
      'faker.number.int({min: 0, max: 100, multipleOf: 5})',
    );
  });

  it('should not include multipleOf when undefined for integer type with Faker v9', () => {
    const integerType: OpenApiSchemaObjectType = 'integer';
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: integerType,
        minimum: 0,
        maximum: 100,
        multipleOf: undefined,
        name: 'test-item',
      },
      context: createContext({ '@faker-js/faker': '^9.0.0' }),
    });

    expect(result.value).toBe('faker.number.int({min: 0, max: 100})');
  });

  it('should not include multipleOf for integer type with Faker v8', () => {
    const integerType: OpenApiSchemaObjectType = 'integer';
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: integerType,
        minimum: 0,
        maximum: 100,
        multipleOf: 5,
        name: 'test-item',
      },
      context: createContext({ '@faker-js/faker': '^8.0.0' }),
    });

    expect(result.value).toBe('faker.number.int({min: 0, max: 100})');
  });

  it('should include multipleOf for number type with Faker v9', () => {
    const numberType: OpenApiSchemaObjectType = 'number';
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: numberType,
        minimum: 0,
        maximum: 100,
        multipleOf: 0.5,
        name: 'test-item',
      },
      context: createContext({ '@faker-js/faker': '^9.0.0' }),
    });

    expect(result.value).toBe(
      'faker.number.float({min: 0, max: 100, multipleOf: 0.5})',
    );
  });

  it('should not include multipleOf when undefined for number type with Faker v9', () => {
    const numberType: OpenApiSchemaObjectType = 'number';
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: numberType,
        minimum: 0,
        maximum: 100,
        multipleOf: undefined,
        name: 'test-item',
      },
      mockOptions: { fractionDigits: 2 },
      context: createContext({ '@faker-js/faker': '^9.0.0' }),
    });

    expect(result.value).toBe(
      'faker.number.float({min: 0, max: 100, fractionDigits: 2})',
    );
  });

  it('should not include multipleOf for number type with Faker v8', () => {
    const numberType: OpenApiSchemaObjectType = 'number';
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: numberType,
        minimum: 0,
        maximum: 100,
        multipleOf: 0.5,
        name: 'test-item',
      },
      mockOptions: { fractionDigits: 2 },
      context: createContext({ '@faker-js/faker': '^8.0.0' }),
    });

    expect(result.value).toBe(
      'faker.number.float({min: 0, max: 100, fractionDigits: 2})',
    );
  });

  it('should use fractionDigits when multipleOf is undefined for number type', () => {
    const numberType: OpenApiSchemaObjectType = 'number';
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: numberType,
        minimum: 0,
        maximum: 100,
        name: 'test-item',
      },
      mockOptions: { fractionDigits: 2 },
      context: createContext(),
    });

    expect(result.value).toBe(
      'faker.number.float({min: 0, max: 100, fractionDigits: 2})',
    );
  });
});

describe('getMockScalar (nested arrays handling)', () => {
  it('should generate valid syntax for nested arrays (array of arrays)', () => {
    const result = getMockScalar({
      item: {
        type: 'array' as const,
        name: 'coordinates',
        items: {
          type: 'array',
          items: { type: 'integer' },
        },
      },
      imports: [],
      operationId: 'test',
      tags: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
      context: { output: { override: {} } } as ContextSpec,
      combine: { separator: 'anyOf' as const, includedProperties: [] },
    });
    // Should avoid putting Array.from in an object {
    // Should NOT include min: undefined or max: undefined
    expect(result.value).toBe(
      'Array.from({ length: faker.number.int() }, (_, i) => i + 1).map(() => (Array.from({ length: faker.number.int() }, (_, i) => i + 1).map(() => (faker.number.int()))))',
    );
  });

  it('should include min/max when arrayMin/arrayMax are provided', () => {
    const result = getMockScalar({
      item: {
        type: 'array' as const,
        name: 'coordinates',
        items: { type: 'integer' },
      },
      imports: [],
      operationId: 'test',
      tags: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
      context: { output: { override: {} } } as ContextSpec,
      mockOptions: { arrayMin: 1, arrayMax: 5 },
    });

    expect(result.value).toContain('faker.number.int({min: 1, max: 5})');
  });
});

describe('getMockScalar (undefined filtering)', () => {
  const baseArg = {
    imports: [],
    operationId: 'test-operation',
    tags: [],
    existingReferencedProperties: [],
    splitMockImplementations: [],
    context: { output: { override: {} } } as ContextSpec,
  };

  it('should not include min/max when they are undefined for integer type', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'integer' as const,
        name: 'test-item',
      },
    });

    expect(result.value).toBe('faker.number.int()');
    expect(result.value).not.toContain('undefined');
  });

  it('should include only min when max is undefined for integer type', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'integer' as const,
        minimum: 0,
        name: 'test-item',
      },
    });

    expect(result.value).toBe('faker.number.int({min: 0})');
  });

  it('should not include min/max when they are undefined for number/float type', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'number' as const,
        name: 'test-item',
      },
    });

    expect(result.value).toBe('faker.number.float()');
    expect(result.value).not.toContain('undefined');
  });

  it('should not include fractionDigits when it is undefined for number/float type', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'number' as const,
        minimum: 0,
        maximum: 100,
        name: 'test-item',
      },
    });

    expect(result.value).toBe('faker.number.float({min: 0, max: 100})');
    expect(result.value).not.toContain('fractionDigits');
    expect(result.value).not.toContain('undefined');
  });

  it('should not include min/max in string length when they are undefined', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        name: 'test-item',
      },
    });

    expect(result.value).toBe('faker.string.alpha()');
    expect(result.value).not.toContain('undefined');
  });

  it('should include string length constraints when provided', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        minLength: 5,
        maxLength: 20,
        name: 'test-item',
      },
    });

    expect(result.value).toBe(
      'faker.string.alpha({length: {min: 5, max: 20}})',
    );
  });
});

describe('getMockScalar (@-prefixed property names)', () => {
  const baseArg = {
    imports: [],
    operationId: 'test-operation',
    tags: [],
    existingReferencedProperties: [],
    splitMockImplementations: [],
    context: { output: { override: {} } } as ContextSpec,
  };

  it('should preserve @type as a quoted property key in mock objects', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        name: 'MyResource',
        properties: {
          '@type': { type: 'string' },
          id: { type: 'integer' },
        },
        required: ['@type', 'id'],
      },
    });

    // Property key should be quoted as '@type', not sanitized to '_type' or 'type'
    expect(result.value).toContain("'@type'");
    expect(result.value).not.toContain('_type');
  });
});
