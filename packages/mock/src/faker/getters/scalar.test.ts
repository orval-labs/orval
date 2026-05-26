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

  it('should clamp min to maxLength when only maxLength is specified and no global stringMin is set', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        maxLength: 5,
        name: 'test-item',
      },
    });

    // faker.string.alpha's `length: { min, max }` requires both bounds, so we
    // collapse to the explicit value rather than inventing a missing one.
    expect(result.value).toBe('faker.string.alpha({length: {min: 5, max: 5}})');
  });

  it('should clamp max to minLength when only minLength is specified and no global stringMax is set', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        minLength: 30,
        name: 'test-item',
      },
    });

    expect(result.value).toBe(
      'faker.string.alpha({length: {min: 30, max: 30}})',
    );
  });

  it('should use global stringMin when only maxLength is specified and global stringMin does not exceed maxLength', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        maxLength: 50,
        name: 'test-item',
      },
      mockOptions: { stringMin: 10, stringMax: 20 },
    });

    expect(result.value).toBe(
      'faker.string.alpha({length: {min: 10, max: 50}})',
    );
  });

  it('should clamp min to maxLength when global stringMin would exceed maxLength', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        maxLength: 5,
        name: 'test-item',
      },
      mockOptions: { stringMin: 10, stringMax: 20 },
    });

    expect(result.value).toBe('faker.string.alpha({length: {min: 5, max: 5}})');
  });

  it('should use global stringMax when only minLength is specified and global stringMax is not below minLength', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        minLength: 5,
        name: 'test-item',
      },
      mockOptions: { stringMin: 10, stringMax: 20 },
    });

    expect(result.value).toBe(
      'faker.string.alpha({length: {min: 5, max: 20}})',
    );
  });

  it('should clamp max to minLength when global stringMax would be below minLength', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        minLength: 30,
        name: 'test-item',
      },
      mockOptions: { stringMin: 10, stringMax: 20 },
    });

    expect(result.value).toBe(
      'faker.string.alpha({length: {min: 30, max: 30}})',
    );
  });

  it('should clamp both bounds to 0 when maxLength is 0 (avoids invalid faker range)', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        maxLength: 0,
        name: 'test-item',
      },
      mockOptions: { stringMin: 10, stringMax: 20 },
    });

    expect(result.value).toBe('faker.string.alpha({length: {min: 0, max: 0}})');
  });

  it('should clamp min to maxItems when only maxItems is specified and no global arrayMin is set', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        maxItems: 5,
        name: 'test-item',
        items: { type: 'string' },
      },
    });

    // Without a global arrayMin to fall back to, reuse maxItems so the
    // generated faker.number.int always has a bounded upper range.
    expect(result.value).toContain('faker.number.int({min: 5, max: 5})');
  });

  it('should clamp max to minItems when only minItems is specified and no global arrayMax is set', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        minItems: 3,
        name: 'test-item',
        items: { type: 'string' },
      },
    });

    // Avoid relying on faker's internal default max which can produce
    // huge arrays; reuse minItems instead.
    expect(result.value).toContain('faker.number.int({min: 3, max: 3})');
  });

  it('should use global arrayMax when only minItems is specified and global arrayMax is not below minItems', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        minItems: 3,
        name: 'test-item',
        items: { type: 'string' },
      },
      mockOptions: { arrayMin: 1, arrayMax: 10 },
    });

    expect(result.value).toContain('faker.number.int({min: 3, max: 10})');
  });

  it('should clamp max to minItems when global arrayMax would be below minItems', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        minItems: 100,
        name: 'test-item',
        items: { type: 'string' },
      },
      mockOptions: { arrayMin: 1, arrayMax: 10 },
    });

    expect(result.value).toContain('faker.number.int({min: 100, max: 100})');
  });

  it('should use global arrayMin when only maxItems is specified and global arrayMin does not exceed maxItems', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        maxItems: 5,
        name: 'test-item',
        items: { type: 'string' },
      },
      mockOptions: { arrayMin: 1, arrayMax: 10 },
    });

    expect(result.value).toContain('faker.number.int({min: 1, max: 5})');
  });

  it('should omit length entirely when only one global string bound is configured and no schema bound is set', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        name: 'test-item',
      },
      mockOptions: { stringMin: 10 },
    });

    // faker.string.alpha's `length: { min, max }` requires both bounds. With
    // only one global side configured we cannot build a valid pair, so fall
    // back to faker's default length rather than emitting a one-sided object.
    expect(result.value).toBe('faker.string.alpha()');
  });
});

describe('getMockScalar (exclusiveMinimum/exclusiveMaximum handling)', () => {
  const baseArg = {
    imports: [],
    operationId: 'test-operation',
    tags: [],
    existingReferencedProperties: [],
    splitMockImplementations: [],
    context: { output: { override: {} } } as ContextSpec,
  };

  describe('OpenAPI 3.0 (boolean exclusiveMinimum/exclusiveMaximum)', () => {
    it('should omit min when exclusiveMinimum is true but minimum is absent', () => {
      const result = getMockScalar({
        ...baseArg,
        item: {
          type: 'integer' as const,
          exclusiveMinimum: true as unknown as number,
          name: 'test-item',
        },
      });

      expect(result.value).toBe('faker.number.int()');
      expect(result.value).not.toContain('true');
    });

    it('should use minimum when exclusiveMinimum is true for integer type', () => {
      const result = getMockScalar({
        ...baseArg,
        item: {
          type: 'integer' as const,
          minimum: 0,
          exclusiveMinimum: true as unknown as number,
          name: 'test-item',
        },
      });

      expect(result.value).toBe('faker.number.int({min: 0})');
      expect(result.value).not.toContain('true');
    });

    it('should use maximum when exclusiveMaximum is true for integer type', () => {
      const result = getMockScalar({
        ...baseArg,
        item: {
          type: 'integer' as const,
          maximum: 100,
          exclusiveMaximum: true as unknown as number,
          name: 'test-item',
        },
      });

      expect(result.value).toBe('faker.number.int({max: 100})');
      expect(result.value).not.toContain('true');
    });

    it('should use minimum and maximum when both exclusive flags are true for number type', () => {
      const result = getMockScalar({
        ...baseArg,
        item: {
          type: 'number' as const,
          minimum: 0,
          maximum: 100,
          exclusiveMinimum: true as unknown as number,
          exclusiveMaximum: true as unknown as number,
          name: 'test-item',
        },
      });

      expect(result.value).toBe('faker.number.float({min: 0, max: 100})');
      expect(result.value).not.toContain('true');
    });
  });

  describe('OpenAPI 3.1 (numeric exclusiveMinimum/exclusiveMaximum)', () => {
    it('should use exclusiveMinimum value directly for integer type', () => {
      const result = getMockScalar({
        ...baseArg,
        item: {
          type: 'integer' as const,
          exclusiveMinimum: 5,
          name: 'test-item',
        },
      });

      expect(result.value).toBe('faker.number.int({min: 5})');
    });

    it('should use exclusiveMaximum value directly for integer type', () => {
      const result = getMockScalar({
        ...baseArg,
        item: {
          type: 'integer' as const,
          exclusiveMaximum: 100,
          name: 'test-item',
        },
      });

      expect(result.value).toBe('faker.number.int({max: 100})');
    });

    it('should use exclusiveMinimum and exclusiveMaximum values directly for number type', () => {
      const result = getMockScalar({
        ...baseArg,
        item: {
          type: 'number' as const,
          exclusiveMinimum: 0,
          exclusiveMaximum: 100,
          name: 'test-item',
        },
      });

      expect(result.value).toBe('faker.number.float({min: 0, max: 100})');
    });
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

describe('getMockScalar (pattern-backed string escaping)', () => {
  it('escapes regex patterns when generating faker.helpers.fromRegExp()', () => {
    const result = getMockScalar({
      item: {
        type: 'string' as const,
        pattern: String.raw`^\+?[1-9]\d{1,14}$`,
        name: 'phone',
      },
      imports: [],
      operationId: 'test-operation',
      tags: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
      context: { output: { override: {} } } as ContextSpec,
    });

    expect(result.value).toBe(
      String.raw`faker.helpers.fromRegExp("^\\+?[1-9]\\d{1,14}$")`,
    );
  });

  it('preserves single quotes in regex patterns when stringifying them', () => {
    const result = getMockScalar({
      item: {
        type: 'string' as const,
        pattern: String.raw`^[a-zA-Z0-9']*$`,
        name: 'username',
      },
      imports: [],
      operationId: 'test-operation',
      tags: [],
      existingReferencedProperties: [],
      splitMockImplementations: [],
      context: { output: { override: {} } } as ContextSpec,
    });

    expect(result.value).toBe(
      String.raw`faker.helpers.fromRegExp("^[a-zA-Z0-9']*$")`,
    );
  });
});

describe('getMockScalar (post-upgrader OAS 3.0 example handling)', () => {
  // OAS 3.0 inputs go through @scalar/openapi-parser's upgrade(), which
  // rewrites property-level `example: <value>` into `examples: [<value>]`
  // and deletes the singular field. The scalar getter must read the array
  // form so that useExamples keeps working for OAS 3.0 specs.
  const baseArg = {
    imports: [],
    operationId: 'test-operation',
    tags: [],
    existingReferencedProperties: [],
    splitMockImplementations: [],
    mockOptions: { useExamples: true },
    context: { output: { override: {} } } as ContextSpec,
  };

  it('uses examples[0] for a string property when useExamples is true', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'string' as const,
        name: 'slug',
        examples: ['relaxation'],
      } as Parameters<typeof getMockScalar>[0]['item'],
    });

    expect(result.value).toBe('"relaxation"');
  });
});

describe('getMockScalar (array items $ref extraction and recursion guard)', () => {
  const baseArg = {
    imports: [],
    operationId: 'test-operation',
    tags: [],
    splitMockImplementations: [],
    existingReferencedProperties: ['Foo'],
    context: { output: { override: {} } } as ContextSpec,
  };

  it('returns [] when items.$ref is a circular reference', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        name: 'test-item',
        items: { $ref: '#/components/schemas/Foo' },
      },
    });

    expect(result.value).toBe('[]');
  });

  it('returns [] when items is allOf with a single circular $ref', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        name: 'test-item',
        items: { allOf: [{ $ref: '#/components/schemas/Foo' }] },
      },
    });

    expect(result.value).toBe('[]');
  });

  it('returns [] when items is oneOf with a single circular $ref', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        name: 'test-item',
        items: { oneOf: [{ $ref: '#/components/schemas/Foo' }] },
      },
    });

    expect(result.value).toBe('[]');
  });

  it('returns [] when items is anyOf with a single circular $ref', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        name: 'test-item',
        items: { anyOf: [{ $ref: '#/components/schemas/Foo' }] },
      },
    });

    expect(result.value).toBe('[]');
  });

  it('does not short-circuit for multi-element allOf even if one matches a visited ref', () => {
    const result = getMockScalar({
      ...baseArg,
      item: {
        type: 'array' as const,
        name: 'test-item',
        items: {
          allOf: [
            { $ref: '#/components/schemas/Foo' },
            { $ref: '#/components/schemas/Bar' },
          ],
        },
      },
    });

    expect(result.value).not.toBe('[]');
  });
});
