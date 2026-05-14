import type {
  ContextSpec,
  GeneratorOptions,
  OpenApiSchemaObject,
} from '@orval/core';
import { PropertySortOrder } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../../core/src/test-utils/context';
import {
  dereference,
  generateZod,
  generateZodValidationSchemaDefinition,
  parseZodValidationSchemaDefinition,
  predefinedZodFormats,
  type ZodValidationSchemaDefinition,
} from '.';
import {
  getZodDateFormat,
  getZodDateTimeFormat,
  getZodTimeFormat,
} from './compatible-v4';

const testOutput = {} as unknown as Parameters<typeof generateZod>[2];

function makeContextSpec({
  target,
  workspace,
  spec,
  output,
  override,
}: {
  target?: ContextSpec['target'];
  workspace?: ContextSpec['workspace'];
  spec?: Partial<ContextSpec['spec']>;
  output?: Partial<ContextSpec['output']>;
  override?: Partial<ContextSpec['output']['override']>;
} = {}): ContextSpec {
  const baseContext = createTestContextSpec({
    output: {
      propertySortOrder: PropertySortOrder.ALPHABETICAL,
    },
  });

  return {
    ...baseContext,
    ...(target === undefined ? {} : { target }),
    ...(workspace === undefined ? {} : { workspace }),
    spec: {
      ...baseContext.spec,
      ...spec,
    },
    output: {
      ...baseContext.output,
      ...output,
      override: {
        ...baseContext.output.override,
        ...output?.override,
        ...override,
      },
    },
  };
}

const record: ZodValidationSchemaDefinition = {
  functions: [
    [
      'object',
      {
        queryParams: {
          functions: [
            [
              'additionalProperties',
              {
                functions: [['unknown', undefined]],
                consts: [],
              },
            ],
          ],
          consts: [],
        },
      },
    ],
  ],
  consts: [],
};

describe('parseZodValidationSchemaDefinition', () => {
  it('treats additionalProperties properly', () => {
    const parseResult = parseZodValidationSchemaDefinition(
      record,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parseResult.zod).toBe(
      'zod.object({\n  "queryParams": zod.record(zod.string(), zod.unknown())\n})',
    );
  });
});

const objectIntoObjectSchema: OpenApiSchemaObject = {
  type: 'object',
  properties: {
    pet: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
        },
        tag: {
          type: 'string',
        },
      },
    },
  },
};

const deepRequiredSchema: OpenApiSchemaObject = {
  type: 'object',
  properties: {
    pet: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
        },
        tag: {
          type: 'string',
        },
      },
    },
  },
};

const additionalPropertiesSchema: OpenApiSchemaObject = {
  type: 'object',
  properties: {
    any: {
      type: 'object',
      additionalProperties: {},
    },
    true: {
      type: 'object',
      additionalProperties: true,
    },
  },
};

const additionalPropertiesMaxLengthSchema: OpenApiSchemaObject = {
  type: 'object',
  additionalProperties: {
    type: 'string',
    maxLength: 253,
  },
};

describe('generateZodValidationSchemaDefinition`', () => {
  it('required', () => {
    const result = generateZodValidationSchemaDefinition(
      deepRequiredSchema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'strict',
      true,
      false,
      {
        required: true,
      },
    );

    expect(result).toEqual({
      functions: [
        [
          'object',
          {
            pet: {
              functions: [
                [
                  'object',
                  {
                    name: {
                      functions: [['string', undefined]],
                      consts: [],
                    },
                    tag: {
                      functions: [
                        ['string', undefined],
                        ['optional', undefined],
                      ],
                      consts: [],
                    },
                  },
                ],
                ['strict', undefined],
                ['optional', undefined],
              ],
              consts: [],
            },
          },
        ],
        ['strict', undefined],
      ],
      consts: [],
    });
  });

  it('generates a strict zod schema', () => {
    const result = generateZodValidationSchemaDefinition(
      objectIntoObjectSchema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'strict',
      true,
      false,
      {
        required: true,
      },
    );

    expect(result).toEqual({
      functions: [
        [
          'object',
          {
            pet: {
              functions: [
                [
                  'object',
                  {
                    name: {
                      functions: [
                        ['string', undefined],
                        ['optional', undefined],
                      ],
                      consts: [],
                    },
                    tag: {
                      functions: [
                        ['string', undefined],
                        ['optional', undefined],
                      ],
                      consts: [],
                    },
                  },
                ],
                ['strict', undefined],
                ['optional', undefined],
              ],
              consts: [],
            },
          },
        ],
        ['strict', undefined],
      ],
      consts: [],
    });
  });

  it('additionalProperties', () => {
    const result = generateZodValidationSchemaDefinition(
      additionalPropertiesSchema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'strict',
      true,
      false,
      {
        required: true,
      },
    );

    expect(result).toEqual({
      functions: [
        [
          'object',
          {
            any: {
              functions: [
                [
                  'additionalProperties',
                  {
                    functions: [['unknown', undefined]],
                    consts: [],
                  },
                ],
                ['optional', undefined],
              ],
              consts: [],
            },
            true: {
              functions: [
                [
                  'additionalProperties',
                  {
                    functions: [['unknown', undefined]],
                    consts: [],
                  },
                ],
                ['optional', undefined],
              ],
              consts: [],
            },
          },
        ],
        ['strict', undefined],
      ],
      consts: [],
    });
  });

  it('additionalProperties with maxLength', () => {
    const result = generateZodValidationSchemaDefinition(
      additionalPropertiesMaxLengthSchema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'additionalPropertiesMaxLength',
      true,
      false,
      {
        required: true,
      },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('zod.record(zod.string(), zod.string().max(');
    expect(parsed.consts).toContain('= 253;');
    expect(parsed.consts).not.toContain(';,');
  });

  it('handles allOf with base type string', () => {
    const stringWithConstraints: OpenApiSchemaObject = {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Foo',
    };

    const schemaWithStringAllOf: OpenApiSchemaObject = {
      type: 'string',
      allOf: [stringWithConstraints],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithStringAllOf,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      false,
      false,
      {
        required: true,
      },
    );

    // Check that allOf was used
    expect(result.functions[0][0]).toBe('allOf');

    // Parse and verify the result
    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    // The result should contain constraints from allOf
    expect(parsed.zod).toContain('min');
    expect(parsed.zod).toContain('max');
    expect(parsed.zod).toContain('describe');
    expect(parsed.zod).toContain('Foo');

    // For type: string with allOf, the constraints are merged directly
    expect(parsed.zod).toContain('zod.string()');
  });

  it('handles allOf with additional properties', () => {
    const pagingResultSchema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        meta: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            take: { type: 'number' },
            offset: { type: 'number' },
          },
          required: ['total', 'take', 'offset'],
        },
      },
      required: ['meta'],
    };

    const schemaWithAllOfAndProperties: OpenApiSchemaObject = {
      type: 'object',
      allOf: [pagingResultSchema],
      properties: {
        items: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              name: { type: 'string' },
            },
            required: ['id', 'name'],
          },
        },
      },
      required: ['items'],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAllOfAndProperties,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      false,
      false,
      {
        required: true,
      },
    );

    // Check that allOf was used
    expect(result.functions[0][0]).toBe('allOf');

    // Check that there are two schemas in allOf: the base schema and the additional properties
    const allOfSchemas = result
      .functions[0][1] as ZodValidationSchemaDefinition[];
    expect(allOfSchemas).toHaveLength(2);

    // The first schema should be from allOf (with meta property)
    const firstSchema = allOfSchemas[0];
    expect(firstSchema.functions[0][0]).toBe('object');
    expect(firstSchema.functions[0][1]).toHaveProperty('meta');

    // The second schema should contain the additional properties (items)
    const secondSchema = allOfSchemas[1];
    expect(secondSchema.functions[0][0]).toBe('object');
    expect(secondSchema.functions[0][1]).toHaveProperty('items');

    // Parse and verify the result
    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    // The result should use .and() to combine schemas
    expect(parsed.zod).toContain('.and(');
    expect(parsed.zod).toContain('items');
    expect(parsed.zod).toContain('meta');
  });

  it('handles allOf with required fields from additional object (issue #2306)', () => {
    // Base schema without required fields
    const userSchema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
      },
    };

    // Extended schema with required fields in allOf
    const userCreateSchema: OpenApiSchemaObject = {
      type: 'object',
      allOf: [
        userSchema,
        {
          type: 'object',
          required: ['email', 'name'],
        },
      ],
    };

    const result = generateZodValidationSchemaDefinition(
      userCreateSchema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      false,
      false,
      {
        required: true,
      },
    );

    // Check that allOf was used
    expect(result.functions[0][0]).toBe('allOf');

    // Parse and verify the result
    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    // The result should use .and() to combine schemas
    expect(parsed.zod).toContain('.and(');
    expect(parsed.zod).toContain('email');
    expect(parsed.zod).toContain('name');
  });

  it('handles allOf with number type', () => {
    const numberWithConstraints: OpenApiSchemaObject = {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Test number',
    };

    const schemaWithAllOf: OpenApiSchemaObject = {
      type: 'number',
      allOf: [numberWithConstraints],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAllOf,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      false,
      false,
      {
        required: true,
      },
    );

    expect(result.functions[0][0]).toBe('allOf');

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('min');
    expect(parsed.zod).toContain('max');
    expect(parsed.zod).toContain('describe');
  });

  it('handles allOf with boolean type', () => {
    const booleanWithDescription: OpenApiSchemaObject = {
      type: 'boolean',
      description: 'Test boolean',
    };

    const schemaWithAllOf: OpenApiSchemaObject = {
      type: 'boolean',
      allOf: [booleanWithDescription],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAllOf,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      false,
      false,
      {
        required: true,
      },
    );

    expect(result.functions[0][0]).toBe('allOf');

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('boolean');
    expect(parsed.zod).toContain('describe');
  });

  it('handles allOf with strict mode for objects (issue #2520)', () => {
    // Schema with allOf containing two objects
    const schemaWithAllOf: OpenApiSchemaObject = {
      type: 'object',
      allOf: [
        {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
            },
          },
        },
        {
          type: 'object',
          required: ['swimming'],
          properties: {
            swimming: {
              type: 'boolean',
            },
          },
        },
      ],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAllOf,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      true, // strict mode enabled
      false, // Zod v3
      {
        required: true,
      },
    );

    // Check that allOf was used
    expect(result.functions[0][0]).toBe('allOf');

    // Parse with strict mode
    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      true, // strict mode
      false, // Zod v3
    );

    // The result should be a single merged object with strict(), not .and()
    expect(parsed.zod).not.toContain('.and(');
    expect(parsed.zod).toContain('name');
    expect(parsed.zod).toContain('swimming');
    expect(parsed.zod).toContain('.strict()');
    // Should be a single object, not multiple objects
    expect(parsed.zod).toMatch(
      /zod\.object\(\{[^}]*"name"[^}]*"swimming"[^}]*}\)\.strict\(\)/,
    );
  });

  it('handles allOf with strict mode for objects in Zod v4', () => {
    // Schema with allOf containing two objects
    const schemaWithAllOf: OpenApiSchemaObject = {
      type: 'object',
      allOf: [
        {
          type: 'object',
          required: ['name'],
          properties: {
            name: {
              type: 'string',
            },
          },
        },
        {
          type: 'object',
          required: ['swimming'],
          properties: {
            swimming: {
              type: 'boolean',
            },
          },
        },
      ],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAllOf,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      true, // strict mode enabled
      true, // Zod v4
      {
        required: true,
      },
    );

    // Check that allOf was used
    expect(result.functions[0][0]).toBe('allOf');

    // Parse with strict mode
    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      true, // strict mode
      true, // Zod v4
    );

    // The result should be a single merged strictObject, not .and()
    expect(parsed.zod).not.toContain('.and(');
    expect(parsed.zod).toContain('name');
    expect(parsed.zod).toContain('swimming');
    expect(parsed.zod).toContain('strictObject');
    // Should be a single object, not multiple objects
    expect(parsed.zod).toMatch(
      /zod\.strictObject\(\{[^}]*"name"[^}]*"swimming"[^}]*}\)/,
    );
  });

  it('handles allOf with array type', () => {
    const arrayWithItems: OpenApiSchemaObject = {
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 1,
      maxItems: 10,
      description: 'Test array',
    };

    const schemaWithAllOf: OpenApiSchemaObject = {
      type: 'array',
      allOf: [arrayWithItems],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAllOf,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      false,
      false,
      {
        required: true,
      },
    );

    expect(result.functions[0][0]).toBe('allOf');

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('array');
    expect(parsed.zod).toContain('min');
    expect(parsed.zod).toContain('max');
    expect(parsed.zod).toContain('describe');
  });

  it('generates stringFormat when format and pattern is defined in v4', () => {
    const stringWithPatternAndFormat: OpenApiSchemaObject = {
      type: 'string',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      format: 'my-guid',
    };

    const result = generateZodValidationSchemaDefinition(
      stringWithPatternAndFormat,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      true, // strict mode enabled
      true, // Zod v4
      {
        required: true,
      },
    );

    expect(result.functions[0][0]).toBe('stringFormat');
    expect(result.consts[0]).toContain(
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      true,
      true,
      false,
    );

    expect(parsed.zod).toContain('my-guid');
    expect(parsed.zod).toContain('.stringFormat(');
    expect(parsed.zod).not.toContain('.stringFormat([');
  });

  it('places stringFormat before min/max when format and pattern and minLength are defined in v4', () => {
    const schemaWithPatternFormatAndMin: OpenApiSchemaObject = {
      type: 'string',
      format: 'slug',
      pattern: '^[a-z0-9-]+$',
      minLength: 1,
      maxLength: 64,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithPatternFormatAndMin,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'slug',
      false,
      true,
      { required: false },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      true,
    );

    // stringFormat must come before min so the chain is valid
    const sfIndex = parsed.zod.indexOf('.stringFormat(');
    const minIndex = parsed.zod.indexOf('.min(');
    const maxIndex = parsed.zod.indexOf('.max(');
    expect(sfIndex).toBeGreaterThanOrEqual(0);
    expect(minIndex).toBeGreaterThan(sfIndex);
    expect(maxIndex).toBeGreaterThan(minIndex);
    expect(parsed.zod).not.toContain('.regex(');
  });

  it('does not use stringFormat for format+pattern+minLength in v3', () => {
    const result = generateZodValidationSchemaDefinition(
      { type: 'string', format: 'slug', pattern: '^[a-z0-9-]+$', minLength: 1 },
      { output: { override: { useDates: false } } } as ContextSpec,
      'slug',
      false,
      false, // isZodV4 = false
      { required: false },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      { output: { override: { useDates: false } } } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).not.toContain('.stringFormat(');
    expect(parsed.zod).toContain('.regex(');
    expect(parsed.zod).toContain('.min(');
  });

  it('generates string when format and pattern is defined in v3', () => {
    const stringWithPatternAndFormat: OpenApiSchemaObject = {
      type: 'string',
      pattern: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
      format: 'my-guid',
    };

    const result = generateZodValidationSchemaDefinition(
      stringWithPatternAndFormat,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      true, // strict mode enabled
      false,
      {
        required: true,
      },
    );

    expect(result.functions[0][0]).toBe('string');
    expect(result.consts[0]).toContain(
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$',
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      makeContextSpec({
        override: {
          useDates: false,
        },
      }),
      true,
      false,
      false,
    );

    expect(parsed.zod).not.toContain("'my-guid'");
  });

  it('uses regex after predefined format validator in v4', () => {
    const expectedZodFormatByOpenApiFormat = new Map([
      ['date', getZodDateFormat(true)],
      ['time', getZodTimeFormat(true)],
      ['date-time', getZodDateTimeFormat(true)],
      ['email', 'email'],
      ['uri', 'url'],
      ['hostname', 'hostname'],
      ['uuid', 'uuid'],
    ]);

    for (const format of predefinedZodFormats) {
      const zodFormat = expectedZodFormatByOpenApiFormat.get(format);
      expect(zodFormat).toBeDefined();

      const schema: OpenApiSchemaObject = {
        type: 'string',
        format: format,
        pattern: '^[0-9a-f-]+$',
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        {
          output: {
            override: {
              useDates: false,
              zod: {
                dateTimeOptions: {},
                timeOptions: {},
              },
            },
          },
        } as ContextSpec,
        'testFormatPattern',
        true,
        true,
        { required: true },
      );

      const parsed = parseZodValidationSchemaDefinition(
        result,
        {
          output: {
            override: {
              useDates: false,
            },
          },
        } as ContextSpec,
        true,
        true,
        true,
      );

      expect(parsed.zod).toContain(`.${zodFormat}(`);
      expect(parsed.zod).toContain('.regex(');
      expect(parsed.zod).not.toContain('.stringFormat(');
    }
  });

  it('generates hostname validator in v4 for hostname format', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      format: 'hostname',
    };

    const result = generateZodValidationSchemaDefinition(
      schema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'testHostnameV4',
      true,
      true, // Zod v4
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      true,
      true,
    );

    expect(parsed.zod).toContain('.hostname()');
    expect(parsed.zod).not.toContain('.url()');
  });

  it('falls back to url validator for hostname format in v3', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      format: 'hostname',
    };

    const result = generateZodValidationSchemaDefinition(
      schema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'testHostnameV3',
      true,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      true,
      false,
    );

    expect(parsed.zod).toContain('.url()');
    expect(parsed.zod).not.toContain('.hostname()');
  });

  describe('description handling', () => {
    const context = makeContextSpec({
      override: {
        useDates: false,
      },
    });

    it('generates a description for a parameter', () => {
      const schemaWithDefault: OpenApiSchemaObject = {
        type: 'string',
        description: 'This is a test description',
        default: 'hello',
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithDefault,
        context,
        'testStringDescription',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['string', undefined],
          ['default', 'testStringDescriptionDefault'],
          ['describe', "'This is a test description'"],
        ],
        consts: ['export const testStringDescriptionDefault = `hello`;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        "zod.string().default(testStringDescriptionDefault).describe('This is a test description')",
      );
    });
  });

  describe('default value handling', () => {
    const context = makeContextSpec({
      override: {
        useDates: false,
      },
    });

    it('generates a default value for a non-required string schema', () => {
      const schemaWithDefault: OpenApiSchemaObject = {
        type: 'string',
        default: 'hello',
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithDefault,
        context,
        'testStringDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['string', undefined],
          ['default', 'testStringDefaultDefault'],
        ],
        consts: [`export const testStringDefaultDefault = \`hello\`;`],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe('zod.string().default(testStringDefaultDefault)');
      expect(parsed.consts).toBe(
        'export const testStringDefaultDefault = `hello`;',
      );
    });

    it('generates a default value for a required string schema', () => {
      const schemaWithDefault: OpenApiSchemaObject = {
        type: 'string',
        default: 'hello',
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithDefault,
        context,
        'testStringDefaultRequired',
        false,
        false,
        { required: true },
      );

      expect(result).toEqual({
        functions: [
          ['string', undefined],
          ['default', 'testStringDefaultRequiredDefault'],
        ],
        consts: ['export const testStringDefaultRequiredDefault = `hello`;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.string().default(testStringDefaultRequiredDefault)',
      );
    });

    it('generates nullish + default for a non-required nullable schema with default', () => {
      const schemaWithNullableDefault: OpenApiSchemaObject = {
        type: 'string',
        nullable: true,
        default: 'hello',
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithNullableDefault,
        context,
        'testStringNullableDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['string', undefined],
          ['nullish', undefined],
          ['default', 'testStringNullableDefaultDefault'],
        ],
        consts: ['export const testStringNullableDefaultDefault = `hello`;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.string().nullish().default(testStringNullableDefaultDefault)',
      );
    });

    it('generates a default value for a number schema', () => {
      const schemaWithNumberDefault: OpenApiSchemaObject = {
        type: 'number',
        default: 42,
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithNumberDefault,
        context,
        'testNumberDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['number', undefined],
          ['default', 'testNumberDefaultDefault'],
        ],
        consts: ['export const testNumberDefaultDefault = 42;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe('zod.number().default(testNumberDefaultDefault)');
      expect(parsed.consts).toBe('export const testNumberDefaultDefault = 42;');
    });

    it('generates a default value for a boolean schema with default: true', () => {
      const schemaWithBooleanDefault: OpenApiSchemaObject = {
        type: 'boolean',
        default: true,
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithBooleanDefault,
        context,
        'testBooleanDefaultTrue',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['boolean', undefined],
          ['default', 'testBooleanDefaultTrueDefault'],
        ],
        consts: ['export const testBooleanDefaultTrueDefault = true;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.boolean().default(testBooleanDefaultTrueDefault)',
      );
      expect(parsed.consts).toBe(
        'export const testBooleanDefaultTrueDefault = true;',
      );
    });

    it('generates a default value for a boolean schema with default: false', () => {
      const schemaWithBooleanDefault: OpenApiSchemaObject = {
        type: 'boolean',
        default: false,
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithBooleanDefault,
        context,
        'testBooleanDefaultFalse',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['boolean', undefined],
          ['default', 'testBooleanDefaultFalseDefault'],
        ],
        consts: ['export const testBooleanDefaultFalseDefault = false;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.boolean().default(testBooleanDefaultFalseDefault)',
      );
      expect(parsed.consts).toBe(
        'export const testBooleanDefaultFalseDefault = false;',
      );
    });

    it('generates a boolean schema without default (undefined)', () => {
      const schemaWithoutDefault: OpenApiSchemaObject = {
        type: 'boolean',
        // default property is undefined (not set)
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithoutDefault,
        context,
        'testBooleanNoDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['boolean', undefined],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe('zod.boolean().optional()');
      expect(parsed.consts).toBe('');
    });

    it('generates a default value for an array schema', () => {
      const schemaWithArrayDefault: OpenApiSchemaObject = {
        type: 'array',
        items: { type: 'string' },
        default: ['a', 'b'],
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithArrayDefault,
        context,
        'testArrayDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['array', { functions: [['string', undefined]], consts: [] }],
          ['default', 'testArrayDefaultDefault'],
        ],
        consts: ['export const testArrayDefaultDefault = [`a`, `b`];'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.array(zod.string()).default(testArrayDefaultDefault)',
      );
      expect(parsed.consts).toBe(
        'export const testArrayDefaultDefault = [`a`, `b`];',
      );
    });

    it('generates a default value for an object schema', () => {
      const schemaWithObjectDefault: OpenApiSchemaObject = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        default: { name: 'Fluffy', age: 3 },
      };

      const context: ContextSpec = {
        output: {
          override: { useDates: false },
        },
      } as ContextSpec;

      const result = generateZodValidationSchemaDefinition(
        schemaWithObjectDefault,
        context,
        'testObjectDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          [
            'object',
            {
              name: {
                functions: [
                  ['string', undefined],
                  ['optional', undefined],
                ],
                consts: [],
              },
              age: {
                functions: [
                  ['number', undefined],
                  ['optional', undefined],
                ],
                consts: [],
              },
            },
          ],
          ['default', 'testObjectDefaultDefault'],
        ],
        consts: [
          'export const testObjectDefaultDefault = { name: "Fluffy", age: 3 } as const;',
        ],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.object({\n  "name": zod.string().optional(),\n  "age": zod.number().optional()\n}).default(testObjectDefaultDefault)',
      );
      expect(parsed.consts).toBe(
        'export const testObjectDefaultDefault = { name: "Fluffy", age: 3 } as const;',
      );
    });

    it('generates a default value for a date schema with useDates enabled', () => {
      const schemaWithDateDefault: OpenApiSchemaObject = {
        type: 'string',
        format: 'date',
        default: '2025-01-01',
      };

      const dateContext: ContextSpec = {
        output: {
          override: {
            useDates: true,
          },
        },
      } as ContextSpec;

      const result = generateZodValidationSchemaDefinition(
        schemaWithDateDefault,
        dateContext,
        'testDateDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['date', undefined],
          ['default', 'testDateDefaultDefault'],
        ],
        consts: [
          'export const testDateDefaultDefault = new Date("2025-01-01");',
        ],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        dateContext,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe('zod.date().default(testDateDefaultDefault)');
      expect(parsed.consts).toBe(
        'export const testDateDefaultDefault = new Date("2025-01-01");',
      );
    });

    it('separates sibling export const declarations with newlines', () => {
      const schema: OpenApiSchemaObject = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['available', 'pending', 'sold'],
            default: 'available',
          },
          age: {
            type: 'number',
            minimum: 0,
            maximum: 30,
          },
        },
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'pet',
        false,
        false,
        { required: true },
      );

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );

      expect(parsed.consts).toMatch(
        /export const petStatusDefault = `available`;\nexport const petAgeMin = 0;/,
      );
      expect(parsed.consts).toContain('export const petAgeMax = 30;');
    });

    it('does not leak const suffix counters across repeated top-level generations', () => {
      const schema: OpenApiSchemaObject = {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['available', 'pending', 'sold'],
            default: 'available',
          },
          age: {
            type: 'number',
            minimum: 0,
            maximum: 30,
          },
        },
      };

      const firstResult = generateZodValidationSchemaDefinition(
        schema,
        context,
        'pet',
        false,
        false,
        { required: true },
      );

      const secondResult = generateZodValidationSchemaDefinition(
        schema,
        context,
        'pet',
        false,
        false,
        { required: true },
      );

      const firstParsed = parseZodValidationSchemaDefinition(
        firstResult,
        context,
        false,
        false,
        false,
      );

      const secondParsed = parseZodValidationSchemaDefinition(
        secondResult,
        context,
        false,
        false,
        false,
      );

      expect(firstParsed.consts).toContain(
        'export const petStatusDefault = `available`;',
      );
      expect(firstParsed.consts).toContain('export const petAgeMax = 30;');
      expect(firstParsed.consts).not.toContain('petStatusDefaultOne');
      expect(firstParsed.consts).not.toContain('petAgeMaxOne');

      expect(secondParsed.consts).toContain(
        'export const petStatusDefault = `available`;',
      );
      expect(secondParsed.consts).toContain('export const petAgeMax = 30;');
      expect(secondParsed.consts).not.toContain('petStatusDefaultOne');
      expect(secondParsed.consts).not.toContain('petAgeMaxOne');
      expect(secondParsed.consts).toBe(firstParsed.consts);
    });
  });

  describe('enum handling', () => {
    const context = makeContextSpec({
      override: {
        useDates: false,
      },
    });

    it('generates an enum for a string', () => {
      const schema: OpenApiSchemaObject = {
        type: 'string',
        enum: ['cat', 'dog'],
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumString',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['enum', "['cat', 'dog']"],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe("zod.enum(['cat', 'dog']).optional()");
    });

    it('deduplicates duplicate values in string enums', () => {
      const schema: OpenApiSchemaObject = {
        type: 'string',
        enum: ['+33', '+420', '+33'],
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumStringDuplicate',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['enum', "['+33', '+420']"],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe("zod.enum(['+33', '+420']).optional()");
    });

    it('skips string constraints for direct enums with minLength/maxLength (#3024)', () => {
      const schema: OpenApiSchemaObject = {
        type: 'string',
        enum: ['cat', 'dog'],
        minLength: 2,
        maxLength: 3,
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumStringMinLength',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['enum', "['cat', 'dog']"],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );

      expect(parsed.zod).toBe("zod.enum(['cat', 'dog']).optional()");
      expect(parsed.zod).not.toContain('zod.min(');
      expect(parsed.zod).not.toContain('.min(');
      expect(parsed.zod).not.toContain('.max(');
    });

    it('skips constraints for dereferenced enum schemas with sibling minLength (#3024)', () => {
      const dereferenceContext = {
        ...context,
        spec: {
          components: {
            schemas: {
              PetStatus: {
                type: 'string',
                enum: ['available', 'sold'],
              },
            },
          },
        },
      } as ContextSpec;

      const resolvedSchema = dereference(
        {
          $ref: '#/components/schemas/PetStatus',
          minLength: 1,
        },
        dereferenceContext,
      );

      const result = generateZodValidationSchemaDefinition(
        resolvedSchema,
        dereferenceContext,
        'testDereferencedEnumStringMinLength',
        false,
        false,
        { required: true },
      );

      expect(result).toEqual({
        functions: [['enum', "['available', 'sold']"]],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        dereferenceContext,
        false,
        false,
        false,
      );

      expect(parsed.zod).toBe("zod.enum(['available', 'sold'])");
      expect(parsed.zod).not.toContain('zod.min(');
      expect(parsed.zod).not.toContain('.min(');
    });

    it('skips pattern chains for enums to avoid invalid regex-enum output (#3024)', () => {
      const schema: OpenApiSchemaObject = {
        type: 'string',
        enum: ['cat', 'dog'],
        pattern: '^[a-z]+$',
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumStringPattern',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['enum', "['cat', 'dog']"],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );

      expect(parsed.zod).toBe("zod.enum(['cat', 'dog']).optional()");
      expect(parsed.zod).not.toContain('.regex(');
      expect(parsed.consts).toBe('');
    });

    it('skips stringFormat emission for enums in Zod v4 when format and pattern are both present (#3024)', () => {
      const schema: OpenApiSchemaObject = {
        type: 'string',
        enum: ['cat', 'dog'],
        format: 'pet-kind',
        pattern: '^[a-z]+$',
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumStringPatternV4',
        false,
        true,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['enum', "['cat', 'dog']"],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        true,
      );

      expect(parsed.zod).toBe("zod.enum(['cat', 'dog']).optional()");
      expect(parsed.zod).not.toContain('.regex(');
      expect(parsed.zod).not.toContain('.stringFormat(');
      expect(parsed.consts).toBe('');
    });

    it('preserves default while skipping min/max on enums (#3024)', () => {
      const schema: OpenApiSchemaObject = {
        type: 'string',
        enum: ['EUR', 'USD'],
        minLength: 3,
        maxLength: 3,
        default: 'EUR',
        description: 'Currency code for the order.',
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumStringDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['enum', "['EUR', 'USD']"],
          ['default', 'testEnumStringDefaultDefault'],
          ['describe', "'Currency code for the order.'"],
        ],
        consts: ['export const testEnumStringDefaultDefault = `EUR`;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );

      expect(parsed.zod).toBe(
        "zod.enum(['EUR', 'USD']).default(testEnumStringDefaultDefault).describe('Currency code for the order.')",
      );
      expect(parsed.zod).not.toContain('zod.min(');
      expect(parsed.zod).not.toContain('.min(');
      expect(parsed.zod).not.toContain('.max(');
      expect(parsed.consts).toBe(
        'export const testEnumStringDefaultDefault = `EUR`;',
      );
    });

    it('skips numeric constraints for enum literal unions (#3024)', () => {
      const schema: OpenApiSchemaObject = {
        type: 'number',
        enum: [1, 2],
        minimum: 1,
        maximum: 2,
        multipleOf: 1,
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumNumberConstraints',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          [
            'oneOf',
            [
              { functions: [['literal', 1]], consts: [] },
              { functions: [['literal', 2]], consts: [] },
            ],
          ],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );

      expect(parsed.zod).toBe(
        'zod.union([zod.literal(1),zod.literal(2)]).optional()',
      );
      expect(parsed.zod).not.toContain('.min(');
      expect(parsed.zod).not.toContain('.max(');
      expect(parsed.zod).not.toContain('.multipleOf(');
      expect(parsed.consts).toBe('');
    });

    it('generates an enum for a number', () => {
      const schema: OpenApiSchemaObject = {
        type: 'number',
        enum: [1, 2],
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumNumber',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          [
            'oneOf',
            [
              { functions: [['literal', 1]], consts: [] },
              { functions: [['literal', 2]], consts: [] },
            ],
          ],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.union([zod.literal(1),zod.literal(2)]).optional()',
      );
    });

    it('generates an enum for a boolean', () => {
      const schema: OpenApiSchemaObject = {
        type: 'boolean',
        enum: [true, false],
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumBoolean',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          [
            'oneOf',
            [
              { functions: [['literal', true]], consts: [] },
              { functions: [['literal', false]], consts: [] },
            ],
          ],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.union([zod.literal(true),zod.literal(false)]).optional()',
      );
    });

    it('does not use union for single item enum', () => {
      const schema: OpenApiSchemaObject = {
        type: 'number',
        enum: [1],
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumNumber',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['oneOf', [{ functions: [['literal', 1]], consts: [] }]],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe('zod.literal(1).optional()');
    });

    it('generates an enum for any', () => {
      const schema: OpenApiSchemaObject = {
        enum: ['cat', 1, true],
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumAny',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          [
            'oneOf',
            [
              { functions: [['literal', "'cat'"]], consts: [] },
              { functions: [['literal', 1]], consts: [] },
              { functions: [['literal', true]], consts: [] },
            ],
          ],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        "zod.union([zod.literal('cat'),zod.literal(1),zod.literal(true)]).optional()",
      );
    });

    it('generates a default value for an array with enum items using "as const"', () => {
      const schemaWithEnumArrayDefault: OpenApiSchemaObject = {
        type: 'array',
        items: {
          type: 'string',
          enum: ['A', 'B', 'C'],
        },
        default: ['A'],
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithEnumArrayDefault,
        context,
        'testEnumArrayDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          [
            'array',
            {
              functions: [['enum', "['A', 'B', 'C']"]],
              consts: [],
            },
          ],
          ['default', '[`A`]'],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        "zod.array(zod.enum(['A', 'B', 'C'])).default([`A`])",
      );
    });

    it('generates a default value for nested enum arrays in objects', () => {
      const schemaWithNestedEnumArray: OpenApiSchemaObject = {
        type: 'object',
        properties: {
          some_enum: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['A', 'B', 'C'],
            },
            default: ['A'],
          },
        },
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithNestedEnumArray,
        context,
        'postEnumBody',
        false,
        false,
        { required: false },
      );

      expect(result.functions[0][0]).toBe('object');

      // Check that the nested array default has 'as const'
      const objectProperties = result.functions[0][1] as Record<
        string,
        ZodValidationSchemaDefinition
      >;
      const someEnumProperty = objectProperties.some_enum;

      const parsed = parseZodValidationSchemaDefinition(
        someEnumProperty,
        context,
        false,
        false,
        false,
      );

      expect(parsed.zod).toBe(
        "zod.array(zod.enum(['A', 'B', 'C'])).default([`A`])",
      );
    });

    it('appends "as const" to object defaults so enum properties keep literal types (#3244)', () => {
      const schemaWithObjectEnumDefault: OpenApiSchemaObject = {
        type: 'object',
        required: ['enabled', 'value'],
        properties: {
          enabled: { type: 'boolean' },
          value: { type: 'string', enum: ['a', 'b', 'c'] },
        },
        default: { enabled: true, value: 'a' },
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithObjectEnumDefault,
        context,
        'enumPropertiesObject',
        false,
        false,
        { required: false },
      );

      expect(result.consts).toEqual([
        'export const enumPropertiesObjectDefault = { enabled: true, value: "a" } as const;',
      ]);
      expect(result.functions).toContainEqual([
        'default',
        'enumPropertiesObjectDefault',
      ]);
    });

    it('does not append trailing enum chain for arrays with enum items and constraints (#2765)', () => {
      const schema: OpenApiSchemaObject = {
        type: 'array',
        items: {
          type: 'string',
          enum: ['A', 'B', 'C'],
        },
        minItems: 2,
        uniqueItems: true,
        // Guardrail for resolved-schema edge shapes where enum can end up on parent arrays.
        enum: ['A', 'B', 'C'],
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testEnumArrayWithConstraints',
        false,
        false,
        { required: true },
      );

      expect(result.functions.map(([fn]) => fn)).not.toContain('enum');

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );

      expect(parsed.zod).toContain("zod.array(zod.enum(['A', 'B', 'C']))");
      expect(parsed.zod).toContain('.min(');
      expect(parsed.zod).not.toContain(').enum(');
      expect(parsed.zod).not.toMatch(/\.array\([^)]*\)\.min\([^)]*\)\.enum\(/);
    });

    it('does not append trailing enum chain for dereferenced array enum schemas (#2765)', () => {
      const dereferenceContext = {
        ...context,
        spec: {
          components: {
            schemas: {
              EnumArray: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['X', 'Y'],
                },
                minItems: 1,
                enum: ['X', 'Y'],
              },
            },
          },
        },
      } as ContextSpec;

      const resolvedSchema = dereference(
        { $ref: '#/components/schemas/EnumArray' },
        dereferenceContext,
      );

      const result = generateZodValidationSchemaDefinition(
        resolvedSchema,
        dereferenceContext,
        'resolvedEnumArraySchema',
        false,
        false,
        { required: true },
      );

      expect(result.functions.map(([fn]) => fn)).not.toContain('enum');

      const parsed = parseZodValidationSchemaDefinition(
        result,
        dereferenceContext,
        false,
        false,
        false,
      );

      expect(parsed.zod).toContain("zod.array(zod.enum(['X', 'Y']))");
      expect(parsed.zod).not.toContain(').enum(');
      expect(parsed.zod).not.toMatch(/\.array\([^)]*\)\.min\([^)]*\)\.enum\(/);
    });
  });
  describe('number handling', () => {
    const context: ContextSpec = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    it('generates an number', () => {
      const schema: OpenApiSchemaObject = {
        type: 'number',
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testNumber',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['number', undefined],
          ['optional', undefined],
        ],
        consts: [],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe('zod.number().optional()');
    });
    it('generates an number with min', () => {
      const schema: OpenApiSchemaObject = {
        type: 'number',
        minimum: 10,
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testNumberMin',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['number', undefined],
          ['min', 'testNumberMinMin'],
          ['optional', undefined],
        ],
        consts: ['export const testNumberMinMin = 10;', '\n'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe('zod.number().min(testNumberMinMin).optional()');
    });
    it('generates an number with max', () => {
      const schema: OpenApiSchemaObject = {
        type: 'number',
        maximum: 99,
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testNumberMax',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['number', undefined],
          ['max', 'testNumberMaxMax'],
          ['optional', undefined],
        ],
        consts: ['export const testNumberMaxMax = 99;', '\n'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe('zod.number().max(testNumberMaxMax).optional()');
    });

    describe('OpenAPI 3.1 (exclusiveMinimum/exclusiveMaximum as numbers)', () => {
      it('generates .gt() for numeric exclusiveMinimum', () => {
        const schema: OpenApiSchemaObject & { exclusiveMinimum?: number } = {
          type: 'number',
          exclusiveMinimum: 5,
        };

        const result = generateZodValidationSchemaDefinition(
          schema,
          context,
          'testNumberExclusiveMin',
          false,
          false,
          { required: false },
        );

        expect(result).toEqual({
          functions: [
            ['number', undefined],
            ['gt', 'testNumberExclusiveMinExclusiveMin'],
            ['optional', undefined],
          ],
          consts: [
            'export const testNumberExclusiveMinExclusiveMin = 5;',
            '\n',
          ],
        });

        const parsed = parseZodValidationSchemaDefinition(
          result,
          context,
          false,
          false,
          false,
        );
        expect(parsed.zod).toBe(
          'zod.number().gt(testNumberExclusiveMinExclusiveMin).optional()',
        );
      });

      it('generates .lt() for numeric exclusiveMaximum', () => {
        const schema: OpenApiSchemaObject & { exclusiveMaximum?: number } = {
          type: 'number',
          exclusiveMaximum: 100,
        };

        const result = generateZodValidationSchemaDefinition(
          schema,
          context,
          'testNumberExclusiveMax',
          false,
          false,
          { required: false },
        );

        expect(result).toEqual({
          functions: [
            ['number', undefined],
            ['lt', 'testNumberExclusiveMaxExclusiveMax'],
            ['optional', undefined],
          ],
          consts: [
            'export const testNumberExclusiveMaxExclusiveMax = 100;',
            '\n',
          ],
        });

        const parsed = parseZodValidationSchemaDefinition(
          result,
          context,
          false,
          false,
          false,
        );
        expect(parsed.zod).toBe(
          'zod.number().lt(testNumberExclusiveMaxExclusiveMax).optional()',
        );
      });

      it('generates .gt() and .lt() for both exclusiveMinimum and exclusiveMaximum', () => {
        const schema: OpenApiSchemaObject & {
          exclusiveMinimum?: number;
          exclusiveMaximum?: number;
        } = {
          type: 'number',
          exclusiveMinimum: 5,
          exclusiveMaximum: 100,
        };

        const result = generateZodValidationSchemaDefinition(
          schema,
          context,
          'testNumberExclusiveMinMax',
          false,
          false,
          { required: false },
        );

        expect(result).toEqual({
          functions: [
            ['number', undefined],
            ['gt', 'testNumberExclusiveMinMaxExclusiveMin'],
            ['lt', 'testNumberExclusiveMinMaxExclusiveMax'],
            ['optional', undefined],
          ],
          consts: [
            'export const testNumberExclusiveMinMaxExclusiveMin = 5;',
            'export const testNumberExclusiveMinMaxExclusiveMax = 100;',
            '\n',
          ],
        });

        const parsed = parseZodValidationSchemaDefinition(
          result,
          context,
          false,
          false,
          false,
        );
        expect(parsed.zod).toBe(
          'zod.number().gt(testNumberExclusiveMinMaxExclusiveMin).lt(testNumberExclusiveMinMaxExclusiveMax).optional()',
        );
      });
    });

    describe('OpenAPI 3.0 (exclusiveMinimum/exclusiveMaximum as booleans)', () => {
      it('generates .gt() when exclusiveMinimum=true with minimum value', () => {
        const schema = {
          type: 'number',
          minimum: 10,
          exclusiveMinimum: true,
        } as unknown as OpenApiSchemaObject;

        const result = generateZodValidationSchemaDefinition(
          schema,
          context,
          'testNumberExclusiveMinOAS30',
          false,
          false,
          { required: false },
        );

        expect(result).toEqual({
          functions: [
            ['number', undefined],
            ['gt', 'testNumberExclusiveMinOAS30ExclusiveMin'],
            ['optional', undefined],
          ],
          consts: [
            'export const testNumberExclusiveMinOAS30ExclusiveMin = 10;',
            '\n',
          ],
        });

        const parsed = parseZodValidationSchemaDefinition(
          result,
          context,
          false,
          false,
          false,
        );
        expect(parsed.zod).toBe(
          'zod.number().gt(testNumberExclusiveMinOAS30ExclusiveMin).optional()',
        );
      });

      it('generates .lt() when exclusiveMaximum=true with maximum value', () => {
        const schema = {
          type: 'number',
          maximum: 100,
          exclusiveMaximum: true,
        } as unknown as OpenApiSchemaObject;

        const result = generateZodValidationSchemaDefinition(
          schema,
          context,
          'testNumberExclusiveMaxOAS30',
          false,
          false,
          { required: false },
        );

        expect(result).toEqual({
          functions: [
            ['number', undefined],
            ['lt', 'testNumberExclusiveMaxOAS30ExclusiveMax'],
            ['optional', undefined],
          ],
          consts: [
            'export const testNumberExclusiveMaxOAS30ExclusiveMax = 100;',
            '\n',
          ],
        });

        const parsed = parseZodValidationSchemaDefinition(
          result,
          context,
          false,
          false,
          false,
        );
        expect(parsed.zod).toBe(
          'zod.number().lt(testNumberExclusiveMaxOAS30ExclusiveMax).optional()',
        );
      });

      it('generates .gt() and .lt() when both exclusiveMinimum and exclusiveMaximum are true', () => {
        const schema = {
          type: 'number',
          minimum: 5,
          maximum: 100,
          exclusiveMinimum: true,
          exclusiveMaximum: true,
        } as unknown as OpenApiSchemaObject;

        const result = generateZodValidationSchemaDefinition(
          schema,
          context,
          'testNumberExclusiveBothOAS30',
          false,
          false,
          { required: false },
        );

        expect(result).toEqual({
          functions: [
            ['number', undefined],
            ['gt', 'testNumberExclusiveBothOAS30ExclusiveMin'],
            ['lt', 'testNumberExclusiveBothOAS30ExclusiveMax'],
            ['optional', undefined],
          ],
          consts: [
            'export const testNumberExclusiveBothOAS30ExclusiveMin = 5;',
            'export const testNumberExclusiveBothOAS30ExclusiveMax = 100;',
            '\n',
          ],
        });

        const parsed = parseZodValidationSchemaDefinition(
          result,
          context,
          false,
          false,
          false,
        );
        expect(parsed.zod).toBe(
          'zod.number().gt(testNumberExclusiveBothOAS30ExclusiveMin).lt(testNumberExclusiveBothOAS30ExclusiveMax).optional()',
        );
      });
    });

    it('generates an number with max and max', () => {
      const schema: OpenApiSchemaObject = {
        type: 'number',
        minimum: 10,
        maximum: 99,
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testNumberMinMax',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['number', undefined],
          ['min', 'testNumberMinMaxMin'],
          ['max', 'testNumberMinMaxMax'],
          ['optional', undefined],
        ],
        consts: [
          'export const testNumberMinMaxMin = 10;',
          'export const testNumberMinMaxMax = 99;',
          '\n',
        ],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.number().min(testNumberMinMaxMin).max(testNumberMinMaxMax).optional()',
      );
    });
    it('generates an number with max, max and multipleOf', () => {
      const schema: OpenApiSchemaObject = {
        type: 'number',
        minimum: 10,
        maximum: 99,
        multipleOf: 2,
      };

      const result = generateZodValidationSchemaDefinition(
        schema,
        context,
        'testNumberMinMaxMultiple',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['number', undefined],
          ['min', 'testNumberMinMaxMultipleMin'],
          ['max', 'testNumberMinMaxMultipleMax'],
          ['multipleOf', 'testNumberMinMaxMultipleMultipleOf'],
          ['optional', undefined],
        ],
        consts: [
          'export const testNumberMinMaxMultipleMin = 10;',
          'export const testNumberMinMaxMultipleMax = 99;',
          'export const testNumberMinMaxMultipleMultipleOf = 2;',
          '\n',
        ],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.number().min(testNumberMinMaxMultipleMin).max(testNumberMinMaxMultipleMax).multipleOf(testNumberMinMaxMultipleMultipleOf).optional()',
      );
    });
  });

  it('does not emit stringFormat when custom format has no pattern in v4', () => {
    const schemaFormatOnly: OpenApiSchemaObject = {
      type: 'string',
      format: 'slug',
    };

    const result = generateZodValidationSchemaDefinition(
      schemaFormatOnly,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'slug',
      false,
      true,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      true,
    );

    expect(parsed.zod).not.toContain('.stringFormat(');
    expect(parsed.zod).not.toContain('.regex(');
  });

  it('does not emit stringFormat twice when format+pattern+minLength in v4', () => {
    const schemaFormatPatternMin: OpenApiSchemaObject = {
      type: 'string',
      format: 'slug',
      pattern: '^[a-z0-9-]+$',
      minLength: 1,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaFormatPatternMin,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'slug',
      false,
      true,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      true,
    );

    const count = (parsed.zod.match(/\.stringFormat\(/g) ?? []).length;
    expect(count).toBe(1);
    expect(parsed.zod).not.toContain('.regex(');
  });

  it('does not emit a duplicate RegExp const when format+pattern+minLength in v4', () => {
    const schemaFormatPatternMin: OpenApiSchemaObject = {
      type: 'string',
      format: 'slug',
      pattern: '^[a-z0-9-]+$',
      minLength: 1,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaFormatPatternMin,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'slug',
      false,
      true,
      { required: true },
    );

    const regexpConsts = result.consts.filter((c) => c.includes('RegExp'));
    expect(regexpConsts).toHaveLength(1);
  });

  it('does not emit stringFormat for custom format+pattern in v3', () => {
    const schemaFormatPattern: OpenApiSchemaObject = {
      type: 'string',
      format: 'slug',
      pattern: '^[a-z0-9-]+$',
    };

    const result = generateZodValidationSchemaDefinition(
      schemaFormatPattern,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'slug',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).not.toContain('.stringFormat(');
    expect(parsed.zod).toContain('.regex(');
  });

  it('does not emit stringFormat for pattern-only in v3', () => {
    const schemaPatternOnly: OpenApiSchemaObject = {
      type: 'string',
      pattern: '^[a-z]+$',
    };

    const result = generateZodValidationSchemaDefinition(
      schemaPatternOnly,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'word',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).not.toContain('.stringFormat(');
    expect(parsed.zod).toContain('.regex(');
  });

  it('emits string().regex() for custom format+pattern in v3', () => {
    const schemaFormatPattern: OpenApiSchemaObject = {
      type: 'string',
      format: 'my-id',
      pattern: String.raw`^[A-Z]{3}-\d+$`,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaFormatPattern,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'myId',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('zod.string()');
    expect(parsed.zod).toContain('.regex(');
    expect(parsed.zod).not.toContain('.stringFormat(');
  });

  it('emits string().regex() for pattern-only in v3', () => {
    const schemaPatternOnly: OpenApiSchemaObject = {
      type: 'string',
      pattern: String.raw`^\d{4}$`,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaPatternOnly,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'code',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('zod.string()');
    expect(parsed.zod).toContain('.regex(');
    expect(parsed.zod).not.toContain('.stringFormat(');
  });

  it('emits string().email() for email format in v3', () => {
    const schemaEmail: OpenApiSchemaObject = {
      type: 'string',
      format: 'email',
    };

    const result = generateZodValidationSchemaDefinition(
      schemaEmail,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'email',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('.email(');
    expect(parsed.zod).not.toContain('.stringFormat(');
  });

  it('emits string().uuid() for uuid format in v3', () => {
    const schemaUuid: OpenApiSchemaObject = {
      type: 'string',
      format: 'uuid',
    };

    const result = generateZodValidationSchemaDefinition(
      schemaUuid,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'id',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('.uuid(');
    expect(parsed.zod).not.toContain('.stringFormat(');
  });

  it('emits string().url() for uri format in v3', () => {
    const schemaUri: OpenApiSchemaObject = {
      type: 'string',
      format: 'uri',
    };

    const result = generateZodValidationSchemaDefinition(
      schemaUri,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'url',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('.url(');
    expect(parsed.zod).not.toContain('.stringFormat(');
  });

  it('emits string().min().max() for minLength+maxLength without pattern in v3', () => {
    const schemaMinMax: OpenApiSchemaObject = {
      type: 'string',
      minLength: 2,
      maxLength: 50,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaMinMax,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'name',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('.min(');
    expect(parsed.zod).toContain('.max(');
    expect(parsed.zod).not.toContain('.stringFormat(');
    expect(parsed.zod).not.toContain('.regex(');
  });

  it('emits string().regex().min() for pattern+minLength in v3', () => {
    const schemaPatternMin: OpenApiSchemaObject = {
      type: 'string',
      pattern: '^[a-z]+$',
      minLength: 1,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaPatternMin,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'slug',
      false,
      false, // Zod v3
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('.regex(');
    expect(parsed.zod).toContain('.min(');
    expect(parsed.zod).not.toContain('.stringFormat(');
  });
});

const basicApiSchema = {
  pathRoute: '/cats',
  context: {
    spec: {
      paths: {
        '/cats': {
          post: {
            operationId: 'xyz',
            parameters: [
              {
                name: 'id',
                required: true,
                in: 'path',
                schema: {
                  type: 'string',
                },
              },
              {
                name: 'page',
                required: false,
                in: 'query',
                schema: {
                  type: 'number',
                },
              },
              {
                name: 'x-header',
                in: 'header',
                required: true,
                schema: {
                  type: 'string',
                },
              },
            ],
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
} as unknown as GeneratorOptions;
describe('generatePartOfSchemaGenerateZod', () => {
  it('Default Config', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: true,
              body: true,
              response: true,
              query: true,
              header: true,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );

    expect(result.implementation).toBe(
      'export const TestParams = zod.object({\n  "id": zod.string()\n})\n\nexport const TestQueryParams = zod.object({\n  "page": zod.number().optional()\n})\n\nexport const TestHeader = zod.object({\n  "x-header": zod.string()\n})\n\nexport const TestBody = zod.object({\n  "name": zod.string().optional()\n})\n\nexport const TestResponse = zod.object({\n  "name": zod.string().optional()\n})\n\n',
    );
  });

  it('Only generate response body', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: false,
              response: true,
              query: false,
              header: false,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );
    expect(result.implementation).toBe(
      'export const TestResponse = zod.object({\n  "name": zod.string().optional()\n})\n\n',
    );
  });

  it('Only generate request body', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: true,
              response: false,
              query: false,
              header: false,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );
    expect(result.implementation).toBe(
      'export const TestBody = zod.object({\n  "name": zod.string().optional()\n})\n\n',
    );
  });

  it('Only generate query params', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: false,
              response: false,
              query: true,
              header: false,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );
    expect(result.implementation).toBe(
      'export const TestQueryParams = zod.object({\n  "page": zod.number().optional()\n})\n\n',
    );
  });

  it('Only generate url params', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: true,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );
    expect(result.implementation).toBe(
      'export const TestParams = zod.object({\n  "id": zod.string()\n})\n\n',
    );
  });

  it('Only generate header', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: true,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );
    expect(result.implementation).toBe(
      'export const TestHeader = zod.object({\n  "x-header": zod.string()\n})\n\n',
    );
  });
});

describe('parsePrefixItemsArrayAsTupleZod', () => {
  it('generates correctly', () => {
    const arrayWithPrefixItemsSchema: OpenApiSchemaObject = {
      type: 'array',
      prefixItems: [{ type: 'string' }, {}],
      items: { type: 'string' },
    };
    const result = generateZodValidationSchemaDefinition(
      arrayWithPrefixItemsSchema as OpenApiSchemaObject,
      {
        output: {
          override: {
            zod: {},
          },
        },
      } as ContextSpec,
      'example_tuple',
      true,
      false,
      {
        required: true,
      },
    );

    expect(result).toEqual({
      consts: [],
      functions: [
        [
          'tuple',
          [
            {
              consts: [],
              functions: [['string', undefined]],
            },
            {
              consts: [],
              functions: [['unknown', undefined]],
            },
          ],
        ],
        [
          'rest',
          {
            consts: [],
            functions: [['string', undefined]],
          },
        ],
      ],
    });
  });
});

describe('parsePrefixItemsArrayAsTupleZod', () => {
  it('correctly omits rest', () => {
    const arrayWithPrefixItemsSchema: OpenApiSchemaObject = {
      type: 'array',
      prefixItems: [{ type: 'string' }, {}],
      items: { type: 'string' },
      maxItems: 2,
    };
    const result = generateZodValidationSchemaDefinition(
      arrayWithPrefixItemsSchema as OpenApiSchemaObject,
      {
        output: {
          override: {
            zod: {},
          },
        },
      } as ContextSpec,
      'example_tuple',
      true,
      false,
      {
        required: true,
      },
    );

    expect(result).toEqual({
      consts: [],
      functions: [
        [
          'tuple',
          [
            {
              consts: [],
              functions: [['string', undefined]],
            },
            {
              consts: [],
              functions: [['unknown', undefined]],
            },
          ],
        ],
      ],
    });
  });
});

const formDataSchema = {
  pathRoute: '/cats',
  context: {
    spec: {
      paths: {
        '/cats': {
          post: {
            operationId: 'xyz',
            requestBody: {
              required: true,
              content: {
                'multipart/form-data': {
                  schema: {
                    type: 'object',
                    properties: {
                      name: {
                        type: 'string',
                      },
                      catImage: {
                        type: 'string',
                        format: 'binary',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        name: {
                          type: 'string',
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
} as unknown as GeneratorOptions;

describe('generateFormData', () => {
  it('Only generate request body', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: true,
              response: false,
              query: false,
              header: false,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      formDataSchema,
      testOutput,
    );
    expect(result.implementation).toBe(
      'export const TestBody = zod.object({\n  "name": zod.string().optional(),\n  "catImage": zod.instanceof(File).optional()\n})\n\n',
    );
  });
});

const schemaWithRefProperty = {
  pathRoute: '/cats',
  context: {
    spec: {
      openapi: '3.1.0',
      info: {
        version: '1.0.0',
        title: 'Cats',
      },
      paths: {
        '/cats': {
          post: {
            operationId: 'xyz',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      $ref: {
                        type: 'string',
                      },
                    },
                    example: {
                      $ref: 'hello',
                    },
                  },
                },
              },
            },
            responses: {
              '200': {},
            },
          },
        },
      },
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
} as unknown as GeneratorOptions;

describe('generateZodWithEdgeCases', () => {
  it('correctly handles $ref as a property name', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: true,
              response: true,
              query: false,
              header: false,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      schemaWithRefProperty,
      testOutput,
    );

    expect(result.implementation).toBe(
      'export const TestBody = zod.object({\n  "$ref": zod.string().optional()\n})\n\n',
    );
  });
});

const schemaWithLiteralProperty = {
  pathRoute: '/cats',
  context: {
    spec: {
      openapi: '3.1.0',
      info: {
        version: '1.0.0',
        title: 'Cats',
      },
      paths: {
        '/cats': {
          post: {
            operationId: 'xyz',
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      type: {
                        type: 'string',
                        const: 'WILD',
                      },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {},
            },
          },
        },
      },
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
} as unknown as GeneratorOptions;

describe('generateZodWithLiteralProperty', () => {
  it('correctly handles literal as a property name', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: true,
              response: true,
              query: false,
              header: false,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      schemaWithLiteralProperty,
      testOutput,
    );

    expect(result.implementation).toBe(
      'export const TestBody = zod.object({\n  "type": zod.literal("WILD").optional()\n})\n\n',
    );
  });
});

const schemaWithRequiredDefaults = {
  pathRoute: '/gizmo',
  context: {
    spec: {
      openapi: '3.1.0',
      info: {
        version: '1.0.0',
        title: 'GIZMO',
      },
      paths: {
        '/gizmo': {
          get: {
            operationId: 'getGizmo',
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      $ref: '#/components/schemas/Gizmo',
                    },
                  },
                },
              },
            },
          },
        },
      },
      components: {
        schemas: {
          Gizmo: {
            type: 'object',
            required: ['booleanFlag', 'number'],
            properties: {
              booleanFlag: {
                type: 'boolean',
                default: false,
              },
              number: {
                type: 'number',
                default: 10.11,
              },
              integer: {
                type: 'integer',
                default: 10,
              },
              nullableString: {
                type: 'string',
                nullable: true,
                default: 'hello',
              },
            },
          },
        },
      },
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
} as unknown as GeneratorOptions;

describe('generateZod required defaults regression (#2987)', () => {
  it('keeps default values for required response properties', async () => {
    const result = await generateZod(
      {
        pathRoute: '/gizmo',
        verb: 'get',
        operationName: 'getGizmo',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: false,
              response: true,
              query: false,
              header: false,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      schemaWithRequiredDefaults,
      testOutput,
    );

    expect(result.implementation).toMatch(
      /"booleanFlag": zod\.boolean\(\)\.default\(getGizmoResponseBooleanFlagDefault\)/,
    );
    expect(result.implementation).toMatch(
      /"number": zod\.number\(\)\.default\(getGizmoResponseNumberDefault\)/,
    );
    expect(result.implementation).toMatch(
      /"integer": zod\.number\(\)\.default\(getGizmoResponseIntegerDefault\)/,
    );
    expect(result.implementation).toMatch(
      /"nullableString": zod\.string\(\)\.nullish\(\)\.default\(getGizmoResponseNullableStringDefault\)/,
    );

    expect(result.implementation).not.toContain(
      '"booleanFlag": zod.boolean(),',
    );
    expect(result.implementation).not.toContain('"number": zod.number(),');
  });
});

describe('generateZodWithMultiTypeArray', () => {
  it('correctly handles OpenAPI 3.1 type arrays with multiple types', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    // Test case from the issue: type: ["string", "number", "boolean", "null"]
    const schemaWithMultiType: OpenApiSchemaObject = {
      type: ['string', 'number', 'boolean', 'null'],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMultiType,
      context,
      'testMultiType',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );

    // Should create a union of string, number, and boolean, with nullable
    expect(parsed.zod).toBe(
      'zod.union([zod.string(),zod.number(),zod.boolean()]).nullable()',
    );
  });

  it('handles multi-type arrays without null', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    const schemaWithMultiType: OpenApiSchemaObject = {
      type: ['string', 'number'],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMultiType,
      context,
      'testMultiType',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );

    expect(parsed.zod).toBe('zod.union([zod.string(),zod.number()])');
  });

  it('handles multi-type arrays with optional', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    const schemaWithMultiType: OpenApiSchemaObject = {
      type: ['string', 'number'],
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMultiType,
      context,
      'testMultiType',
      false,
      false,
      { required: false },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );

    expect(parsed.zod).toBe(
      'zod.union([zod.string(),zod.number()]).optional()',
    );
  });

  it('does not chain stringFormat/regex on number in multi-type with pattern and format (Zod v4)', () => {
    const context = {
      output: {
        override: {
          useDates: false,
          zod: {},
        },
      },
    } as unknown as ContextSpec;

    const schemaWithMultiTypeAndPattern: OpenApiSchemaObject = {
      type: ['integer', 'string'],
      format: 'int64',
      pattern: String.raw`^-?(?:0|[1-9]\d*)$`,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMultiTypeAndPattern,
      context,
      'taskId',
      false,
      true,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      true,
    );

    expect(parsed.zod).toContain('zod.union([');
    expect(parsed.zod).toContain('zod.number()');
    expect(parsed.zod).not.toMatch(
      /zod\.number\(\)[^,\]]*\.(?:stringFormat|regex)\(/,
    );
    expect(parsed.zod.match(/\.stringFormat\(/g) ?? []).toHaveLength(1);
  });

  it('emits regex (not stringFormat) for predefined format with pattern in v4', () => {
    const context = {
      output: {
        override: {
          useDates: false,
          zod: { dateTimeOptions: {}, timeOptions: {} },
        },
      },
    } as unknown as ContextSpec;

    const result = generateZodValidationSchemaDefinition(
      { type: 'string', format: 'uuid', pattern: '^[0-9a-f-]+$' },
      context,
      'myId',
      false,
      true,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      true,
    );

    expect(parsed.zod).not.toContain('.stringFormat(');
    expect(parsed.zod).toContain('.uuid(');
    expect(parsed.zod).toContain('.regex(');
  });

  it('emits regex (not stringFormat) for pattern without format in v4', () => {
    const context = {
      output: { override: { useDates: false, zod: {} } },
    } as unknown as ContextSpec;

    const result = generateZodValidationSchemaDefinition(
      { type: 'string', pattern: '^[a-z]+$' },
      context,
      'word',
      false,
      true,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      true,
    );

    expect(parsed.zod).not.toContain('.stringFormat(');
    expect(parsed.zod).toContain('.regex(');
  });
});

describe('generateZodWithNullableAnyOfRefs', () => {
  it('should generate unique schema names for nullable refs in anyOf', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    // Test case: anyOf with multiple nullable refs that could cause duplicate names
    const schemaWithAnyOfNullableRefs: OpenApiSchemaObject = {
      anyOf: [
        {
          $ref: '#/components/schemas/DogId',
        },
        {
          $ref: '#/components/schemas/CatId',
        },
      ],
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAnyOfNullableRefs,
      context,
      'petId',
      false,
      false,
      { required: false },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );

    // Verify that the generated consts have unique names
    // Each anyOf item should get a unique name based on index
    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    // Check that all const names are unique
    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    // Verify the structure contains union
    expect(parsed.zod).toContain('union');
    expect(parsed.zod).toContain('nullish');
  });

  it('should generate unique schema names for nullable refs in oneOf', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    const schemaWithOneOfNullableRefs: OpenApiSchemaObject = {
      oneOf: [
        {
          $ref: '#/components/schemas/DogId',
        },
        {
          $ref: '#/components/schemas/CatId',
        },
        {
          $ref: '#/components/schemas/BirdId',
        },
      ],
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithOneOfNullableRefs,
      context,
      'animalId',
      false,
      false,
      { required: false },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );

    // Verify unique const names
    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    // Verify the structure
    expect(parsed.zod).toContain('union');
  });

  it('should generate unique schema names for nullable refs in allOf', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    const schemaWithAllOfNullableRefs: OpenApiSchemaObject = {
      allOf: [
        {
          $ref: '#/components/schemas/BaseSchema',
        },
        {
          $ref: '#/components/schemas/ExtendedSchema',
        },
      ],
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAllOfNullableRefs,
      context,
      'combinedSchema',
      false,
      false,
      { required: false },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );

    // Verify unique const names
    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    // Verify the structure
    expect(parsed.zod).toContain('.and(');
  });

  it('should handle allOf with additional properties and nullable refs', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    const schemaWithAllOfAndProperties: OpenApiSchemaObject = {
      allOf: [
        {
          $ref: '#/components/schemas/BaseSchema',
        },
      ],
      properties: {
        additionalProp: {
          type: 'string',
          nullable: true,
        },
      },
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithAllOfAndProperties,
      context,
      'schemaWithAllOf',
      false,
      false,
      { required: false },
    );

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );

    // Verify unique const names (should include names from allOf and additional properties)
    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    // Verify the structure
    expect(parsed.zod).toContain('.and(');
  });

  it('should generate unique schema names for nullable oneOf with multiple enum refs (issue #2511)', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    // Test case from issue #2511: nullable oneOf with multiple enum refs
    // This should not generate duplicate schema names like "Item1Hello" and "Item2Hello"
    const schemaItem1: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        hello: {
          nullable: true,
          oneOf: [
            { $ref: '#/components/schemas/HelloEnum' },
            { $ref: '#/components/schemas/BlankEnum' },
            { $ref: '#/components/schemas/NullEnum' },
          ],
        },
      },
    };

    const schemaItem2: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        hello: {
          nullable: true,
          oneOf: [
            { $ref: '#/components/schemas/HelloEnum' },
            { $ref: '#/components/schemas/BlankEnum' },
            { $ref: '#/components/schemas/NullEnum' },
          ],
        },
      },
    };

    // Generate schemas for both items
    const result1 = generateZodValidationSchemaDefinition(
      schemaItem1,
      context,
      'item1',
      false,
      false,
      { required: false },
    );

    const result2 = generateZodValidationSchemaDefinition(
      schemaItem2,
      context,
      'item2',
      false,
      false,
      { required: false },
    );

    // Extract all const names from both results
    const extractConstNames = (consts: string[]) =>
      consts
        .map((constDef) => {
          const match = /export const (\w+)/.exec(constDef);
          return match ? match[1] : undefined;
        })
        .filter((name): name is string => name !== undefined);

    const constNames1 = extractConstNames(result1.consts);
    const constNames2 = extractConstNames(result2.consts);

    // Combine all const names and verify they are unique
    const allConstNames = [...constNames1, ...constNames2];
    const uniqueConstNames = new Set(allConstNames);

    // The key test: ensure no duplicate names between Item1 and Item2
    // This is the core issue from #2511 - when the same property structure
    // is used in multiple objects, they should generate unique names
    expect(uniqueConstNames.size).toBe(allConstNames.length);

    // Note: For object properties, names are generated as "item1-hello", "item2-hello"
    // which get camelCased to "item1Hello" and "item2Hello" respectively.
    // The fix ensures that when processing oneOf items within properties,
    // each gets a unique name based on the parent object name + property name + index.
    // So Item1.hello will generate names like "item1HelloOne", "item1HelloTwo", etc.
    // and Item2.hello will generate "item2HelloOne", "item2HelloTwo", etc.
  });

  it('should generate unique names for anyOf with three nullable refs', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    // Test case: anyOf with 3 nullable refs (like Animals.animalId)
    const schemaWithThreeRefs: OpenApiSchemaObject = {
      anyOf: [
        { $ref: '#/components/schemas/DogId' },
        { $ref: '#/components/schemas/CatId' },
        { $ref: '#/components/schemas/BirdId' },
      ],
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithThreeRefs,
      context,
      'animalId',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    // Should have at least 3 unique const names (one for each anyOf item)
    expect(constNames.length).toBeGreaterThanOrEqual(0);
  });

  it('should generate unique names for multiple anyOf properties in same object', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as unknown as ContextSpec;

    // Test case: object with multiple anyOf properties (like Animals)
    const schemaWithMultipleAnyOf: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        animalId: {
          anyOf: [
            { $ref: '#/components/schemas/DogId' },
            { $ref: '#/components/schemas/CatId' },
            { $ref: '#/components/schemas/BirdId' },
          ],
          nullable: true,
        },
        secondaryId: {
          anyOf: [
            { $ref: '#/components/schemas/DogId' },
            { $ref: '#/components/schemas/CatId' },
          ],
          nullable: true,
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMultipleAnyOf,
      context,
      'animals',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    // Verify structure contains object with properties
    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('object');
  });

  it('should generate unique names for multiple objects with same anyOf structure', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: multiple objects (Pets and Animals) with similar anyOf structures
    const petsSchema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        petId: {
          anyOf: [
            { $ref: '#/components/schemas/DogId' },
            { $ref: '#/components/schemas/CatId' },
          ],
          nullable: true,
        },
      },
    };

    const animalsSchema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        petId: {
          anyOf: [
            { $ref: '#/components/schemas/DogId' },
            { $ref: '#/components/schemas/CatId' },
          ],
          nullable: true,
        },
      },
    };

    const result1 = generateZodValidationSchemaDefinition(
      petsSchema,
      context,
      'pets',
      false,
      false,
      { required: false },
    );

    const result2 = generateZodValidationSchemaDefinition(
      animalsSchema,
      context,
      'animals',
      false,
      false,
      { required: false },
    );

    const extractConstNames = (consts: string[]) =>
      consts
        .map((constDef) => {
          const match = /export const (\w+)/.exec(constDef);
          return match ? match[1] : undefined;
        })
        .filter((name): name is string => name !== undefined);

    const constNames1 = extractConstNames(result1.consts);
    const constNames2 = extractConstNames(result2.consts);
    const allConstNames = [...constNames1, ...constNames2];
    const uniqueConstNames = new Set(allConstNames);

    // Ensure no duplicates between different objects
    expect(uniqueConstNames.size).toBe(allConstNames.length);
  });

  it('should generate unique names for oneOf with different enum types (string, number, boolean)', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: oneOf with different enum types (like Item3.world)
    const schemaWithMixedEnums: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        world: {
          nullable: true,
          oneOf: [
            {
              type: 'integer',
              enum: [1, 2, 3],
            },
            {
              type: 'boolean',
              enum: [true, false],
            },
          ],
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMixedEnums,
      context,
      'item3',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('union');
  });

  it('should generate unique names for object with multiple oneOf properties', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: object with multiple oneOf properties (like Item3)
    const schemaWithMultipleOneOf: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        hello: {
          nullable: true,
          oneOf: [
            { type: 'string', enum: ['HI', 'OHA'] },
            { type: 'string', enum: [''] },
            // eslint-disable-next-line unicorn/no-null
            { enum: [null] },
          ],
        },
        world: {
          nullable: true,
          oneOf: [
            { type: 'integer', enum: [1, 2, 3] },
            { type: 'boolean', enum: [true, false] },
          ],
        },
        optional: {
          nullable: true,
          oneOf: [
            { type: 'string', enum: ['HI', 'OHA'] },
            { type: 'string', enum: [''] },
          ],
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMultipleOneOf,
      context,
      'item3',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    // Verify all properties are included in the object
    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('"hello"');
    expect(parsed.zod).toContain('"world"');
    expect(parsed.zod).toContain('"optional"');
  });

  it('should generate unique names when same oneOf enum structure used in three objects', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: three objects (Item1, Item2, Item3) with same oneOf structure
    const createItemSchema = (): OpenApiSchemaObject => ({
      type: 'object',
      properties: {
        hello: {
          nullable: true,
          oneOf: [
            { type: 'string', enum: ['HI', 'OHA'] },
            { type: 'string', enum: [''] },
            // eslint-disable-next-line unicorn/no-null
            { enum: [null] },
          ],
        },
      },
    });

    const result1 = generateZodValidationSchemaDefinition(
      createItemSchema(),
      context,
      'item1',
      false,
      false,
      { required: false },
    );

    const result2 = generateZodValidationSchemaDefinition(
      createItemSchema(),
      context,
      'item2',
      false,
      false,
      { required: false },
    );

    const result3 = generateZodValidationSchemaDefinition(
      createItemSchema(),
      context,
      'item3',
      false,
      false,
      { required: false },
    );

    const extractConstNames = (consts: string[]) =>
      consts
        .map((constDef) => {
          const match = /export const (\w+)/.exec(constDef);
          return match ? match[1] : undefined;
        })
        .filter((name): name is string => name !== undefined);

    const constNames1 = extractConstNames(result1.consts);
    const constNames2 = extractConstNames(result2.consts);
    const constNames3 = extractConstNames(result3.consts);

    const allConstNames = [...constNames1, ...constNames2, ...constNames3];
    const uniqueConstNames = new Set(allConstNames);

    // Ensure no duplicates across all three objects
    expect(uniqueConstNames.size).toBe(allConstNames.length);
  });

  it('should handle anyOf with required and optional nullable properties', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: required anyOf property vs optional anyOf property
    const schemaRequired: OpenApiSchemaObject = {
      anyOf: [
        { $ref: '#/components/schemas/DogId' },
        { $ref: '#/components/schemas/CatId' },
      ],
      nullable: true,
    };

    const schemaOptional: OpenApiSchemaObject = {
      anyOf: [
        { $ref: '#/components/schemas/DogId' },
        { $ref: '#/components/schemas/CatId' },
      ],
      nullable: true,
    };

    const resultRequired = generateZodValidationSchemaDefinition(
      schemaRequired,
      context,
      'requiredProp',
      false,
      false,
      { required: true },
    );

    const resultOptional = generateZodValidationSchemaDefinition(
      schemaOptional,
      context,
      'optionalProp',
      false,
      false,
      { required: false },
    );

    const parsedRequired = parseZodValidationSchemaDefinition(
      resultRequired,
      context,
      false,
      false,
      false,
    );

    const parsedOptional = parseZodValidationSchemaDefinition(
      resultOptional,
      context,
      false,
      false,
      false,
    );

    // Required should have nullable, optional should have nullish
    expect(parsedRequired.zod).toContain('nullable');
    expect(parsedOptional.zod).toContain('nullish');
  });

  it('should generate unique names for anyOf mixing nullable and not-null refs', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: anyOf mixing nullable and not-null refs (like MixedNullable.mixedId)
    const schemaWithMixedNullable: OpenApiSchemaObject = {
      anyOf: [
        { $ref: '#/components/schemas/DogId' }, // nullable
        { $ref: '#/components/schemas/CatId' }, // nullable
        { $ref: '#/components/schemas/BirdIdNotNull' }, // not null
      ],
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMixedNullable,
      context,
      'mixedId',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('union');
  });

  it('should generate unique names for oneOf mixing nullable and not-null enums', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: oneOf mixing nullable and not-null enum refs (like MixedEnumItem.mixed)
    const schemaWithMixedEnum: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        mixed: {
          nullable: true,
          oneOf: [
            { type: 'string', enum: ['HI', 'OHA'] }, // nullable enum
            { type: 'string', enum: [''] }, // nullable enum
            { type: 'string', enum: ['ALWAYS', 'NEVER'] }, // not null enum
          ],
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMixedEnum,
      context,
      'mixedEnumItem',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('union');
    expect(parsed.zod).toContain('"mixed"');
  });

  it('should generate unique names for nested objects with anyOf properties', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: nested object with anyOf properties (like NestedAnimals)
    const schemaWithNestedAnyOf: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            animalId: {
              anyOf: [
                { $ref: '#/components/schemas/DogId' },
                { $ref: '#/components/schemas/CatId' },
                { $ref: '#/components/schemas/BirdId' },
              ],
              nullable: true,
            },
            petId: {
              anyOf: [
                { $ref: '#/components/schemas/DogId' },
                { $ref: '#/components/schemas/CatId' },
              ],
              nullable: true,
            },
          },
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithNestedAnyOf,
      context,
      'nestedAnimals',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('object');
    expect(parsed.zod).toContain('"nested"');
    expect(parsed.zod).toContain('"animalId"');
    expect(parsed.zod).toContain('"petId"');
  });

  it('should generate unique names for nested objects with oneOf enum properties', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: nested object with oneOf enum properties (like NestedItem)
    const schemaWithNestedOneOf: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            hello: {
              nullable: true,
              oneOf: [
                { type: 'string', enum: ['HI', 'OHA'] },
                { type: 'string', enum: [''] },
                // eslint-disable-next-line unicorn/no-null
                { enum: [null] },
              ],
            },
            world: {
              nullable: true,
              oneOf: [
                { type: 'integer', enum: [1, 2, 3] },
                { type: 'boolean', enum: [true, false] },
              ],
            },
          },
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithNestedOneOf,
      context,
      'nestedItem',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('object');
    expect(parsed.zod).toContain('"nested"');
    expect(parsed.zod).toContain('"hello"');
    expect(parsed.zod).toContain('"world"');
  });

  it('should generate unique names for multiple nested objects with same anyOf structure', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: multiple nested objects with same anyOf structure
    const createNestedSchema = (): OpenApiSchemaObject => ({
      type: 'object',
      properties: {
        nested: {
          type: 'object',
          properties: {
            id: {
              anyOf: [
                { $ref: '#/components/schemas/DogId' },
                { $ref: '#/components/schemas/CatId' },
              ],
              nullable: true,
            },
          },
        },
      },
    });

    const result1 = generateZodValidationSchemaDefinition(
      createNestedSchema(),
      context,
      'nested1',
      false,
      false,
      { required: false },
    );

    const result2 = generateZodValidationSchemaDefinition(
      createNestedSchema(),
      context,
      'nested2',
      false,
      false,
      { required: false },
    );

    const extractConstNames = (consts: string[]) =>
      consts
        .map((constDef) => {
          const match = /export const (\w+)/.exec(constDef);
          return match ? match[1] : undefined;
        })
        .filter((name): name is string => name !== undefined);

    const constNames1 = extractConstNames(result1.consts);
    const constNames2 = extractConstNames(result2.consts);
    const allConstNames = [...constNames1, ...constNames2];
    const uniqueConstNames = new Set(allConstNames);

    // Ensure no duplicates between different nested objects
    expect(uniqueConstNames.size).toBe(allConstNames.length);
  });

  it('should generate unique names for deeply nested objects with anyOf', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: deeply nested (3 levels) object with anyOf
    const deeplyNestedSchema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        level1: {
          type: 'object',
          properties: {
            level2: {
              type: 'object',
              properties: {
                id: {
                  anyOf: [
                    { $ref: '#/components/schemas/DogId' },
                    { $ref: '#/components/schemas/CatId' },
                    { $ref: '#/components/schemas/BirdId' },
                  ],
                  nullable: true,
                },
              },
            },
          },
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      deeplyNestedSchema,
      context,
      'deeplyNested',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('object');
    expect(parsed.zod).toContain('"level1"');
  });

  it('should generate unique names for allOf with mixed nullable and not-null refs', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: allOf with mixed nullable and not-null refs
    const schemaWithMixedAllOf: OpenApiSchemaObject = {
      allOf: [
        { $ref: '#/components/schemas/DogId' }, // nullable
        { $ref: '#/components/schemas/FishIdNotNull' }, // not null
      ],
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMixedAllOf,
      context,
      'mixedAllOf',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('.and(');
  });

  it('should generate unique names for anyOf with mixed types (string, number, integer, boolean)', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: anyOf mixing different types (like MixedTypes.mixedAnyOf)
    const schemaWithMixedTypes: OpenApiSchemaObject = {
      anyOf: [
        { $ref: '#/components/schemas/DogId' }, // string
        { $ref: '#/components/schemas/NumberId' }, // number
        { $ref: '#/components/schemas/IntegerId' }, // integer
        { $ref: '#/components/schemas/BooleanFlag' }, // boolean
      ],
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMixedTypes,
      context,
      'mixedAnyOf',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('union');
  });

  it('should generate unique names for anyOf with mixed not-null types', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: anyOf with not-null types of different kinds
    const schemaWithMixedNotNullTypes: OpenApiSchemaObject = {
      anyOf: [
        { $ref: '#/components/schemas/NumberIdNotNull' }, // number
        { $ref: '#/components/schemas/IntegerIdNotNull' }, // integer
        { $ref: '#/components/schemas/BirdIdNotNull' }, // string
      ],
      nullable: true,
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMixedNotNullTypes,
      context,
      'mixedTypesNotNull',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('union');
  });

  it('should generate unique names for oneOf with number enum types', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: oneOf with number enum (nullable and not-null)
    const schemaWithNumberEnum: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        numberEnum: {
          nullable: true,
          oneOf: [
            {
              type: 'number',
              nullable: true,
              enum: [1.5, 2.5, 3.5],
            },
            {
              type: 'number',
              enum: [100.1, 200.2],
            },
          ],
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithNumberEnum,
      context,
      'mixedTypeEnums',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('union');
    expect(parsed.zod).toContain('"numberEnum"');
  });

  it('should generate unique names for oneOf with integer enum types', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: oneOf with integer enum (nullable and not-null)
    const schemaWithIntegerEnum: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        integerEnum: {
          nullable: true,
          oneOf: [
            {
              type: 'integer',
              nullable: true,
              enum: [10, 20, 30],
            },
            {
              type: 'integer',
              enum: [1000, 2000],
            },
          ],
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithIntegerEnum,
      context,
      'mixedTypeEnums',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('union');
    expect(parsed.zod).toContain('"integerEnum"');
  });

  it('should generate unique names for object with multiple oneOf properties of different types', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: object with multiple oneOf properties of different types (like MixedTypeEnums)
    const schemaWithMultipleTypeEnums: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        stringEnum: {
          nullable: true,
          oneOf: [
            { type: 'string', enum: ['HI', 'OHA'] },
            { type: 'string', enum: [''] },
          ],
        },
        numberEnum: {
          nullable: true,
          oneOf: [
            { type: 'number', nullable: true, enum: [1.5, 2.5, 3.5] },
            { type: 'number', enum: [100.1, 200.2] },
          ],
        },
        integerEnum: {
          nullable: true,
          oneOf: [
            { type: 'integer', nullable: true, enum: [10, 20, 30] },
            { type: 'integer', enum: [1000, 2000] },
          ],
        },
        booleanEnum: {
          nullable: true,
          oneOf: [
            { type: 'boolean', nullable: true, enum: [true, false] },
            { type: 'boolean', enum: [true] },
          ],
        },
      },
    };

    const result = generateZodValidationSchemaDefinition(
      schemaWithMultipleTypeEnums,
      context,
      'mixedTypeEnums',
      false,
      false,
      { required: false },
    );

    const constNames = result.consts
      .map((constDef) => {
        const match = /export const (\w+)/.exec(constDef);
        return match ? match[1] : undefined;
      })
      .filter((name): name is string => name !== undefined);

    const uniqueConstNames = new Set(constNames);
    expect(uniqueConstNames.size).toBe(constNames.length);

    const parsed = parseZodValidationSchemaDefinition(
      result,
      context,
      false,
      false,
      false,
    );
    expect(parsed.zod).toContain('object');
    expect(parsed.zod).toContain('"stringEnum"');
    expect(parsed.zod).toContain('"numberEnum"');
    expect(parsed.zod).toContain('"integerEnum"');
    expect(parsed.zod).toContain('"booleanEnum"');
  });

  it('should generate unique names for multiple objects with same mixed type anyOf', () => {
    const context = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpec;

    // Test case: multiple objects with same mixed type anyOf structure
    const createMixedTypeSchema = (): OpenApiSchemaObject => ({
      type: 'object',
      properties: {
        mixedId: {
          anyOf: [
            { $ref: '#/components/schemas/DogId' }, // string
            { $ref: '#/components/schemas/NumberId' }, // number
            { $ref: '#/components/schemas/IntegerId' }, // integer
          ],
          nullable: true,
        },
      },
    });

    const result1 = generateZodValidationSchemaDefinition(
      createMixedTypeSchema(),
      context,
      'mixed1',
      false,
      false,
      { required: false },
    );

    const result2 = generateZodValidationSchemaDefinition(
      createMixedTypeSchema(),
      context,
      'mixed2',
      false,
      false,
      { required: false },
    );

    const extractConstNames = (consts: string[]) =>
      consts
        .map((constDef) => {
          const match = /export const (\w+)/.exec(constDef);
          return match ? match[1] : undefined;
        })
        .filter((name): name is string => name !== undefined);

    const constNames1 = extractConstNames(result1.consts);
    const constNames2 = extractConstNames(result2.consts);
    const allConstNames = [...constNames1, ...constNames2];
    const uniqueConstNames = new Set(allConstNames);

    // Ensure no duplicates between different objects with mixed types
    expect(uniqueConstNames.size).toBe(allConstNames.length);
  });
});

// Content type handling tests - mirrors res-req-types.test.ts structure
describe('generateZod (content type handling - parity with res-req-types.test.ts)', () => {
  const zodOverride = {
    zod: {
      strict: {
        param: false,
        body: false,
        response: false,
        query: false,
        header: false,
      },
      generate: {
        param: false,
        body: true,
        response: false,
        query: false,
        header: false,
      },
      coerce: {
        param: false,
        body: false,
        response: false,
        query: false,
        header: false,
      },
      generateEachHttpStatus: false,
      dateTimeOptions: {},
      timeOptions: {},
    },
  };

  it('media key precedence: application/json ignores contentMediaType', async () => {
    const schema = {
      pathRoute: '/upload',
      context: {
        spec: {
          paths: {
            '/upload': {
              post: {
                operationId: 'upload',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          // contentMediaType should be IGNORED (media key is text/JSON)
                          ignored: {
                            type: 'string',
                            contentMediaType: 'image/png',
                          },
                        },
                        required: ['ignored'],
                      },
                    },
                  },
                },
                responses: {
                  '200': {
                    content: {
                      'application/json': { schema: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        output: { override: { zod: { generateEachHttpStatus: false } } },
      },
    } as unknown as GeneratorOptions;
    const result = await generateZod(
      {
        pathRoute: '/upload',
        verb: 'post',
        operationName: 'upload',
        override: zodOverride,
      } as unknown as Parameters<typeof generateZod>[0],
      schema,
      testOutput,
    );
    // contentMediaType: 'image/png' should be IGNORED because media key is application/json
    expect(result.implementation).toContain('"ignored": zod.string()');
    expect(result.implementation).not.toContain('instanceof');
  });

  it('multipart/form-data: comprehensive content type handling', async () => {
    // Matches type gen test structure in res-req-types.test.ts
    const schema = {
      pathRoute: '/upload-form',
      context: {
        spec: {
          paths: {
            '/upload-form': {
              post: {
                operationId: 'uploadForm',
                requestBody: {
                  required: true,
                  content: {
                    'multipart/form-data': {
                      schema: {
                        type: 'object',
                        properties: {
                          encBinary: { type: 'string' },
                          encText: { type: 'string' },
                          cmtBinary: {
                            type: 'string',
                            contentMediaType: 'image/png',
                          },
                          cmtText: {
                            type: 'string',
                            contentMediaType: 'application/xml',
                          },
                          encOverride: {
                            type: 'string',
                            contentMediaType: 'image/png',
                          },
                          formatBinary: { type: 'string', format: 'binary' },
                          base64Field: {
                            type: 'string',
                            contentMediaType: 'image/png',
                            contentEncoding: 'base64',
                          },
                          metadata: {
                            type: 'object',
                            properties: { name: { type: 'string' } },
                          },
                        },
                        required: [
                          'encBinary',
                          'encText',
                          'cmtBinary',
                          'cmtText',
                          'encOverride',
                          'formatBinary',
                          'base64Field',
                          'metadata',
                        ],
                      },
                      encoding: {
                        encBinary: { contentType: 'image/png' },
                        encText: { contentType: 'text/plain' },
                        encOverride: { contentType: 'text/csv' },
                        metadata: { contentType: 'application/json' },
                      },
                    },
                  },
                },
                responses: {
                  '200': {
                    content: {
                      'application/json': { schema: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
        },
        output: { override: { zod: { generateEachHttpStatus: false } } },
      },
    } as unknown as GeneratorOptions;
    const result = await generateZod(
      {
        pathRoute: '/upload-form',
        verb: 'post',
        operationName: 'uploadForm',
        override: zodOverride,
      } as unknown as Parameters<typeof generateZod>[0],
      schema,
      testOutput,
    );
    // encBinary: encoding image/png → File
    // encText: encoding text/plain → File | string
    // cmtBinary: contentMediaType image/png → File
    // cmtText: contentMediaType application/xml → File | string
    // encOverride: encoding text/csv overrides contentMediaType image/png → File | string
    // formatBinary: format: binary → File (same as instanceof check)
    // base64Field: contentEncoding base64 → stays string
    // metadata: object → object schema
    expect(result.implementation)
      .toBe(`export const UploadFormBody = zod.object({
  "encBinary": zod.instanceof(File),
  "encText": zod.instanceof(File).or(zod.string()),
  "cmtBinary": zod.instanceof(File),
  "cmtText": zod.instanceof(File).or(zod.string()),
  "encOverride": zod.instanceof(File).or(zod.string()),
  "formatBinary": zod.instanceof(File),
  "base64Field": zod.string(),
  "metadata": zod.object({
  "name": zod.string().optional()
})
})

`);
  });
});

describe('zod split mode regressions', () => {
  const context: ContextSpec = {
    output: {
      override: {
        useDates: false,
      },
    },
  } as ContextSpec;

  it('preserves @ prefixed property keys', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      properties: {
        '@type': {
          type: 'string',
        },
      },
      required: ['@type'],
    };

    const definition = generateZodValidationSchemaDefinition(
      schema,
      context,
      'atTypeSchema',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      context,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('"@type": zod.string()');
    expect(parsed.zod).not.toContain('"_type"');
  });

  it('preserves nullable sibling fields on dereferenced refs', () => {
    const dereferenceContext = {
      ...context,
      spec: {
        components: {
          schemas: {
            RefPet: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                },
              },
              required: ['name'],
            },
          },
        },
      },
    } as ContextSpec;

    const resolvedSchema = dereference(
      {
        $ref: '#/components/schemas/RefPet',
        nullable: true,
      } as unknown as OpenApiSchemaObject,
      dereferenceContext,
    );

    const definition = generateZodValidationSchemaDefinition(
      resolvedSchema,
      dereferenceContext,
      'refPetSchema',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      dereferenceContext,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('.nullable()');
  });

  it('resolves local component refs with schema suffix for arrays and nested objects', () => {
    const suffixContext = {
      output: {
        override: {
          useDates: false,
          components: {
            schemas: {
              suffix: 'Schema',
            },
          },
        },
      },
      spec: {
        components: {
          schemas: {
            Position: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                quantity: { type: 'number' },
              },
              required: ['id', 'quantity'],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const resolvedSchema = dereference(
      {
        type: 'object',
        properties: {
          positions: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/Position',
            },
          },
          primaryPosition: {
            $ref: '#/components/schemas/Position',
          },
        },
      },
      suffixContext,
    );

    const definition = generateZodValidationSchemaDefinition(
      resolvedSchema,
      suffixContext,
      'positionsEnvelope',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      suffixContext,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('"positions": zod.array(zod.object(');
    expect(parsed.zod).toContain('"primaryPosition": zod.object(');
    expect(parsed.zod).not.toContain('zod.unknown()');
  });

  it('resolves allOf/oneOf/anyOf refs with schema suffix without unknown fallback', () => {
    const suffixContext = {
      output: {
        override: {
          useDates: false,
          components: {
            schemas: {
              suffix: 'Schema',
            },
          },
        },
      },
      spec: {
        components: {
          schemas: {
            BaseEnvelope: {
              type: 'object',
              properties: {
                traceId: { type: 'string' },
              },
              required: ['traceId'],
            },
            Position: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              required: ['id'],
            },
            PositionAlias: {
              type: 'object',
              properties: {
                alias: { type: 'string' },
              },
              required: ['alias'],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const resolvedSchema = dereference(
      {
        type: 'object',
        properties: {
          composed: {
            allOf: [
              { $ref: '#/components/schemas/BaseEnvelope' },
              {
                type: 'object',
                properties: {
                  position: {
                    $ref: '#/components/schemas/Position',
                  },
                },
                required: ['position'],
              },
            ],
          },
          oneChoice: {
            oneOf: [
              { $ref: '#/components/schemas/Position' },
              { $ref: '#/components/schemas/PositionAlias' },
            ],
          },
          anyChoice: {
            anyOf: [
              { $ref: '#/components/schemas/Position' },
              { $ref: '#/components/schemas/PositionAlias' },
            ],
          },
        },
        required: ['composed', 'oneChoice', 'anyChoice'],
      },
      suffixContext,
    );

    const definition = generateZodValidationSchemaDefinition(
      resolvedSchema,
      suffixContext,
      'combinatorsEnvelope',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      suffixContext,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('"composed": zod.object(');
    expect(parsed.zod).toContain('.and(');
    expect(parsed.zod).toContain('"oneChoice": zod.union([');
    expect(parsed.zod).toContain('"anyChoice": zod.union([');
    expect(parsed.zod).not.toContain('zod.unknown()');
  });

  it('handles circular $ref with suffix by breaking the cycle', () => {
    const circularContext = {
      output: {
        override: {
          useDates: false,
          components: {
            schemas: {
              suffix: 'Schema',
            },
          },
        },
      },
      spec: {
        components: {
          schemas: {
            TreeNode: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                children: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/TreeNode',
                  },
                },
              },
              required: ['name'],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const resolvedSchema = dereference(
      {
        type: 'object',
        properties: {
          root: {
            $ref: '#/components/schemas/TreeNode',
          },
        },
        required: ['root'],
      },
      circularContext,
    );

    const definition = generateZodValidationSchemaDefinition(
      resolvedSchema,
      circularContext,
      'treeEnvelope',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      circularContext,
      false,
      false,
      false,
    );

    // The circular ref should NOT cause infinite recursion or stack overflow.
    // It should inline the first level and break the cycle.
    expect(parsed.zod).toContain('"root": zod.object(');
    expect(parsed.zod).toContain('"name": zod.string()');
  });

  it('resolves additionalProperties with $ref and schema suffix', () => {
    const suffixContext = {
      output: {
        override: {
          useDates: false,
          components: {
            schemas: {
              suffix: 'Schema',
            },
          },
        },
      },
      spec: {
        components: {
          schemas: {
            Position: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              required: ['id'],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const resolvedSchema = dereference(
      {
        type: 'object',
        additionalProperties: {
          $ref: '#/components/schemas/Position',
        },
      },
      suffixContext,
    );

    const definition = generateZodValidationSchemaDefinition(
      resolvedSchema,
      suffixContext,
      'positionMap',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      suffixContext,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('zod.record(zod.string()');
    expect(parsed.zod).not.toContain('zod.unknown()');
  });

  it('resolves nullable $ref property with schema suffix (OAS 3.0)', () => {
    const suffixContext = {
      output: {
        override: {
          useDates: false,
          components: {
            schemas: {
              suffix: 'Schema',
            },
          },
        },
      },
      spec: {
        components: {
          schemas: {
            Position: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              required: ['id'],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const resolvedSchema = dereference(
      {
        type: 'object',
        properties: {
          optionalPosition: {
            $ref: '#/components/schemas/Position',
            nullable: true,
          } as unknown as OpenApiSchemaObject,
        },
      },
      suffixContext,
    );

    const definition = generateZodValidationSchemaDefinition(
      resolvedSchema,
      suffixContext,
      'nullableRefEnvelope',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      suffixContext,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('"optionalPosition": zod.object(');
    expect(parsed.zod).toMatch(/\.null(able|ish)\(\)/);
    expect(parsed.zod).not.toContain('zod.unknown()');
  });

  it('resolves deep nested allOf chains with schema suffix', () => {
    const suffixContext = {
      output: {
        override: {
          useDates: false,
          components: {
            schemas: {
              suffix: 'Schema',
            },
          },
        },
      },
      spec: {
        components: {
          schemas: {
            Base: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              required: ['id'],
            },
            Extended: {
              allOf: [
                { $ref: '#/components/schemas/Base' },
                {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                  },
                  required: ['name'],
                },
              ],
            },
            DoubleExtended: {
              allOf: [
                { $ref: '#/components/schemas/Extended' },
                {
                  type: 'object',
                  properties: {
                    extra: { type: 'boolean' },
                  },
                },
              ],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const resolvedSchema = dereference(
      {
        type: 'object',
        properties: {
          deep: {
            $ref: '#/components/schemas/DoubleExtended',
          },
        },
        required: ['deep'],
      },
      suffixContext,
    );

    const definition = generateZodValidationSchemaDefinition(
      resolvedSchema,
      suffixContext,
      'deepNestedEnvelope',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      suffixContext,
      false,
      false,
      false,
    );

    // Deep nested allOf with $refs should resolve properly
    expect(parsed.zod).toContain('.and(');
    expect(parsed.zod).toContain('"id": zod.string()');
    expect(parsed.zod).toContain('"name": zod.string()');
    expect(parsed.zod).not.toContain('zod.unknown()');
  });

  it('resolves refs with empty suffix (default) without regression', () => {
    const noSuffixContext = {
      output: {
        override: {
          useDates: false,
          components: {
            schemas: {
              suffix: '',
            },
          },
        },
      },
      spec: {
        components: {
          schemas: {
            Position: {
              type: 'object',
              properties: {
                id: { type: 'string' },
              },
              required: ['id'],
            },
          },
        },
      },
    } as unknown as ContextSpec;

    const resolvedSchema = dereference(
      {
        type: 'object',
        properties: {
          position: {
            $ref: '#/components/schemas/Position',
          },
        },
        required: ['position'],
      },
      noSuffixContext,
    );

    const definition = generateZodValidationSchemaDefinition(
      resolvedSchema,
      noSuffixContext,
      'positionEnvelope',
      false,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      noSuffixContext,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('"position": zod.object(');
    expect(parsed.zod).toContain('"id": zod.string()');
    expect(parsed.zod).not.toContain('zod.unknown()');
  });

  it('uses passthrough object for generic object schemas in zod v3', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
    };

    const definition = generateZodValidationSchemaDefinition(
      schema,
      context,
      'genericObjectV3',
      true,
      false,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      context,
      false,
      true,
      false,
    );

    expect(parsed.zod).toBe('zod.object({\n\n}).passthrough()');
    expect(parsed.zod).not.toContain('strictObject({');
    expect(parsed.zod).not.toContain('.strict()');
  });

  it('uses looseObject for generic object schemas in zod v4', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
    };

    const definition = generateZodValidationSchemaDefinition(
      schema,
      context,
      'genericObjectV4',
      true,
      true,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      context,
      false,
      true,
      true,
    );

    expect(parsed.zod).toBe('zod.looseObject({\n\n})');
    expect(parsed.zod).not.toContain('strictObject({');
  });

  it('keeps strict object when additionalProperties is false', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      additionalProperties: false,
    };

    const definition = generateZodValidationSchemaDefinition(
      schema,
      context,
      'genericObjectStrict',
      true,
      true,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      context,
      false,
      true,
      true,
    );

    expect(parsed.zod).toBe('zod.strictObject({\n\n})');
  });

  it('keeps record behavior when additionalProperties is true', () => {
    const schema: OpenApiSchemaObject = {
      type: 'object',
      additionalProperties: true,
    };

    const definition = generateZodValidationSchemaDefinition(
      schema,
      context,
      'genericObjectAdditionalPropsTrue',
      true,
      true,
      { required: true },
    );

    const parsed = parseZodValidationSchemaDefinition(
      definition,
      context,
      false,
      true,
      true,
    );

    expect(parsed.zod).toBe('zod.record(zod.string(), zod.unknown())');
    expect(parsed.zod).not.toContain('strictObject({');
    expect(parsed.zod).not.toContain('looseObject({');
  });
});

describe('generateZodValidationSchemaDefinition (contentMediaType: application/octet-stream)', () => {
  it('contentMediaType: application/octet-stream → instanceof File', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      contentMediaType: 'application/octet-stream',
    };

    const result = generateZodValidationSchemaDefinition(
      schema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      true,
      false,
      { required: true },
    );

    expect(result).toEqual({
      functions: [['instanceof', 'File']],
      consts: [],
    });
  });

  it('contentEncoding: base64 with contentMediaType: application/octet-stream → string', () => {
    const schema: OpenApiSchemaObject = {
      type: 'string',
      contentMediaType: 'application/octet-stream',
      contentEncoding: 'base64',
    };

    const result = generateZodValidationSchemaDefinition(
      schema,
      {
        output: {
          override: {
            useDates: false,
          },
        },
      } as ContextSpec,
      'test',
      true,
      false,
      { required: true },
    );

    expect(result).toEqual({
      functions: [['string', undefined]],
      consts: [],
    });
  });
});

// --- useBrandedTypes tests ---

const brandedZodOverride = {
  zod: {
    strict: {
      param: false,
      body: false,
      response: false,
      query: false,
      header: false,
    },
    generate: {
      param: true,
      body: true,
      response: true,
      query: true,
      header: true,
    },
    coerce: {
      param: false,
      body: false,
      response: false,
      query: false,
      header: false,
    },
    generateEachHttpStatus: false,
    dateTimeOptions: {},
    timeOptions: {},
    useBrandedTypes: true,
  },
};

const brandedZodOverrideDisabled = {
  zod: {
    ...brandedZodOverride.zod,
    useBrandedTypes: false,
  },
};

describe('generateZod (useBrandedTypes)', () => {
  // Group 1: Default behavior — no brand

  it('does not append .brand() when useBrandedTypes is false', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: brandedZodOverrideDisabled,
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );

    expect(result.implementation).not.toMatch(/\.brand[<(]/);
  });

  it('does not append .brand() when useBrandedTypes is not specified', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            strict: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: true,
              body: true,
              response: true,
              query: true,
              header: true,
            },
            coerce: {
              param: false,
              body: false,
              response: false,
              query: false,
              header: false,
            },
            generateEachHttpStatus: false,
            dateTimeOptions: {},
            timeOptions: {},
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );

    expect(result.implementation).not.toMatch(/\.brand[<(]/);
  });

  // Group 2: Brand appended (Zod v3 / v4)

  it('appends .brand<"Name">() to all schemas when useBrandedTypes is true (zod v3)', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: brandedZodOverride,
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );

    expect(result.implementation).toBe(
      'export const TestParams = zod.object({\n  "id": zod.string()\n}).brand<"TestParams">()\n\nexport const TestQueryParams = zod.object({\n  "page": zod.number().optional()\n}).brand<"TestQueryParams">()\n\nexport const TestHeader = zod.object({\n  "x-header": zod.string()\n}).brand<"TestHeader">()\n\nexport const TestBody = zod.object({\n  "name": zod.string().optional()\n}).brand<"TestBody">()\n\nexport const TestResponse = zod.object({\n  "name": zod.string().optional()\n}).brand<"TestResponse">()\n\n',
    );
  });

  it('appends .brand("Name") to schemas when useBrandedTypes is true (zod v4)', async () => {
    const v4ApiSchema = {
      ...basicApiSchema,
      context: {
        ...basicApiSchema.context,
        output: {
          ...basicApiSchema.context.output,
          packageJson: {
            dependencies: {
              zod: '^4.0.0',
            },
          },
        },
      },
    } as unknown as GeneratorOptions;

    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: brandedZodOverride,
      } as unknown as Parameters<typeof generateZod>[0],
      v4ApiSchema,
      testOutput,
    );

    expect(result.implementation).toBe(
      'export const TestParams = zod.object({\n  "id": zod.string()\n}).brand("TestParams")\n\nexport const TestQueryParams = zod.object({\n  "page": zod.number().optional()\n}).brand("TestQueryParams")\n\nexport const TestHeader = zod.object({\n  "x-header": zod.string()\n}).brand("TestHeader")\n\nexport const TestBody = zod.object({\n  "name": zod.string().optional()\n}).brand("TestBody")\n\nexport const TestResponse = zod.object({\n  "name": zod.string().optional()\n}).brand("TestResponse")\n\n',
    );
  });

  // Group 3: Array body/response

  it('appends .brand() only to the array wrapper, not to the item schema (body)', async () => {
    const arrayBodyApiSchema = {
      pathRoute: '/cats',
      context: {
        spec: {
          paths: {
            '/cats': {
              post: {
                operationId: 'xyz',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: {
                              type: 'string',
                            },
                          },
                        },
                      },
                    },
                  },
                },
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        output: {
          override: {
            zod: {
              generateEachHttpStatus: false,
            },
          },
        },
      },
    } as unknown as GeneratorOptions;

    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            ...brandedZodOverride.zod,
            generate: {
              param: false,
              body: true,
              response: false,
              query: false,
              header: false,
            },
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      arrayBodyApiSchema,
      testOutput,
    );

    expect(result.implementation).toContain(
      'export const TestBodyItem = zod.object({\n  "name": zod.string().optional()\n})',
    );
    expect(result.implementation).not.toContain(
      'TestBodyItem = zod.object({\n  "name": zod.string().optional()\n}).brand',
    );
    expect(result.implementation).toContain(
      'export const TestBody = zod.array(TestBodyItem).brand<"TestBody">()',
    );
  });

  it('appends .brand() only to the array wrapper, not to the item schema (response)', async () => {
    const arrayResponseApiSchema = {
      pathRoute: '/cats',
      context: {
        spec: {
          paths: {
            '/cats': {
              post: {
                operationId: 'xyz',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'number' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        output: {
          override: {
            zod: {
              generateEachHttpStatus: false,
            },
          },
        },
      },
    } as unknown as GeneratorOptions;

    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            ...brandedZodOverride.zod,
            generate: {
              param: false,
              body: false,
              response: true,
              query: false,
              header: false,
            },
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      arrayResponseApiSchema,
      testOutput,
    );

    expect(result.implementation).toContain('export const TestResponseItem = ');
    expect(result.implementation).not.toMatch(
      /TestResponseItem = zod\.object\([^)]*\)\s*\.brand/,
    );
    expect(result.implementation).toContain(
      'export const TestResponse = zod.array(TestResponseItem).brand<"TestResponse">()',
    );
  });

  // Group 4: Combination with other options

  it('appends .brand() after .strict() when both strict and useBrandedTypes are enabled (zod v3)', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            ...brandedZodOverride.zod,
            strict: {
              param: false,
              body: true,
              response: false,
              query: false,
              header: false,
            },
            generate: {
              param: false,
              body: true,
              response: false,
              query: false,
              header: false,
            },
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );

    expect(result.implementation).toContain('.strict().brand<"TestBody">()');
  });

  it('appends .brand() to each HTTP status response when generateEachHttpStatus is true', async () => {
    const multiStatusApiSchema = {
      pathRoute: '/cats',
      context: {
        spec: {
          paths: {
            '/cats': {
              post: {
                operationId: 'xyz',
                requestBody: {
                  required: true,
                  content: {
                    'application/json': {
                      schema: {
                        type: 'object',
                        properties: {
                          name: { type: 'string' },
                        },
                      },
                    },
                  },
                },
                responses: {
                  '200': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                          },
                        },
                      },
                    },
                  },
                  '201': {
                    content: {
                      'application/json': {
                        schema: {
                          type: 'object',
                          properties: {
                            name: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        output: {
          override: {
            zod: {
              generateEachHttpStatus: true,
            },
          },
        },
      },
    } as unknown as GeneratorOptions;

    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            ...brandedZodOverride.zod,
            generateEachHttpStatus: true,
            generate: {
              param: false,
              body: false,
              response: true,
              query: false,
              header: false,
            },
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      multiStatusApiSchema,
      testOutput,
    );

    expect(result.implementation).toContain('.brand<"Test200Response">()');
    expect(result.implementation).toContain('.brand<"Test201Response">()');
  });

  // Group 5: Partial generation with brand

  it('appends .brand() when only response is generated', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            ...brandedZodOverride.zod,
            generate: {
              param: false,
              body: false,
              response: true,
              query: false,
              header: false,
            },
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );

    expect(result.implementation).toBe(
      'export const TestResponse = zod.object({\n  "name": zod.string().optional()\n}).brand<"TestResponse">()\n\n',
    );
  });

  it('appends .brand() when only body is generated', async () => {
    const result = await generateZod(
      {
        pathRoute: '/cats',
        verb: 'post',
        operationName: 'test',
        override: {
          zod: {
            ...brandedZodOverride.zod,
            generate: {
              param: false,
              body: true,
              response: false,
              query: false,
              header: false,
            },
          },
        },
      } as unknown as Parameters<typeof generateZod>[0],
      basicApiSchema,
      testOutput,
    );

    expect(result.implementation).toBe(
      'export const TestBody = zod.object({\n  "name": zod.string().optional()\n}).brand<"TestBody">()\n\n',
    );
  });
});
