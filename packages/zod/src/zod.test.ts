import type { ContextSpecs } from '@orval/core';
import type { SchemaObject as SchemaObject30 } from 'openapi3-ts/oas30';
import type { SchemaObject as SchemaObject31 } from 'openapi3-ts/oas31';
import { describe, expect, it } from 'vitest';

import {
  generateZod,
  generateZodValidationSchemaDefinition,
  parseZodValidationSchemaDefinition,
  type ZodValidationSchemaDefinition,
} from '.';

const queryParams: ZodValidationSchemaDefinition = {
  functions: [
    [
      'object',
      {
        // limit = non-required integer schema (coerce-able)
        limit: {
          functions: [
            ['number', undefined],
            ['optional', undefined],
            ['null', undefined],
          ],
          consts: [],
        },

        // q = non-required string array schema (not coerce-able)
        q: {
          functions: [
            [
              'array',
              {
                functions: [['string', undefined]],
                consts: [],
              },
            ],
            ['optional', undefined],
          ],
          consts: [],
        },
      },
    ],
  ],
  consts: [],
};

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
      } as ContextSpecs,
      false,
      false,
      false,
    );

    expect(parseResult.zod).toBe(
      'zod.object({\n  "queryParams": zod.record(zod.string(), zod.unknown())\n})',
    );
  });
});

const objectIntoObjectSchema: SchemaObject30 = {
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

const deepRequiredSchema: SchemaObject30 = {
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

const additionalPropertiesSchema: SchemaObject30 = {
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
      } as ContextSpecs,
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
      } as ContextSpecs,
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
      } as ContextSpecs,
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

  it('handles allOf with base type string', () => {
    const stringWithConstraints: SchemaObject = {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Foo',
    };

    const schemaWithStringAllOf: SchemaObject = {
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
      } as ContextSpecs,
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
      } as ContextSpecs,
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
    const pagingResultSchema: SchemaObject = {
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

    const schemaWithAllOfAndProperties: SchemaObject = {
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
      } as ContextSpecs,
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
    expect(result.functions[0][1]).toHaveLength(2);

    // The first schema should be from allOf (with meta property)
    const firstSchema = result.functions[0][1][0];
    expect(firstSchema.functions[0][0]).toBe('object');
    expect(firstSchema.functions[0][1]).toHaveProperty('meta');

    // The second schema should contain the additional properties (items)
    const secondSchema = result.functions[0][1][1];
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
      } as ContextSpecs,
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
    const userSchema: SchemaObject = {
      type: 'object',
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string' },
      },
    };

    // Extended schema with required fields in allOf
    const userCreateSchema: SchemaObject = {
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
      } as ContextSpecs,
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
      } as ContextSpecs,
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
    const numberWithConstraints: SchemaObject = {
      type: 'number',
      minimum: 0,
      maximum: 100,
      description: 'Test number',
    };

    const schemaWithAllOf: SchemaObject = {
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
      } as ContextSpecs,
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
      } as ContextSpecs,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('min');
    expect(parsed.zod).toContain('max');
    expect(parsed.zod).toContain('describe');
  });

  it('handles allOf with boolean type', () => {
    const booleanWithDescription: SchemaObject = {
      type: 'boolean',
      description: 'Test boolean',
    };

    const schemaWithAllOf: SchemaObject = {
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
      } as ContextSpecs,
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
      } as ContextSpecs,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('boolean');
    expect(parsed.zod).toContain('describe');
  });

  it('handles allOf with array type', () => {
    const arrayWithItems: SchemaObject = {
      type: 'array',
      items: {
        type: 'string',
      },
      minItems: 1,
      maxItems: 10,
      description: 'Test array',
    };

    const schemaWithAllOf: SchemaObject = {
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
      } as ContextSpecs,
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
      } as ContextSpecs,
      false,
      false,
      false,
    );

    expect(parsed.zod).toContain('array');
    expect(parsed.zod).toContain('min');
    expect(parsed.zod).toContain('max');
    expect(parsed.zod).toContain('describe');
  });

  describe('description handling', () => {
    const context: ContextSpecs = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpecs;

    it('generates a description for a parameter', () => {
      const schemaWithDefault: SchemaObject30 = {
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
        consts: ['export const testStringDescriptionDefault = "hello";'],
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
    const context: ContextSpecs = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpecs;

    it('generates a default value for a non-required string schema', () => {
      const schemaWithDefault: SchemaObject30 = {
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
        consts: [`export const testStringDefaultDefault = "hello";`],
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
        'export const testStringDefaultDefault = "hello";',
      );
    });

    it('generates a default value for a number schema', () => {
      const schemaWithNumberDefault: SchemaObject30 = {
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
      const schemaWithBooleanDefault: SchemaObject30 = {
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
      const schemaWithBooleanDefault: SchemaObject30 = {
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
      const schemaWithoutDefault: SchemaObject30 = {
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
      const schemaWithArrayDefault: SchemaObject30 = {
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
        consts: ['export const testArrayDefaultDefault = ["a", "b"];'],
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
        'export const testArrayDefaultDefault = ["a", "b"];',
      );
    });

    it('generates a default value for an object schema', () => {
      const schemaWithObjectDefault: SchemaObject30 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
        },
        default: { name: 'Fluffy', age: 3 },
      };

      const context: ContextSpecs = {
        output: {
          override: { useDates: false },
        },
      } as ContextSpecs;

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
          'export const testObjectDefaultDefault = { name: "Fluffy", age: 3 };',
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
        'export const testObjectDefaultDefault = { name: "Fluffy", age: 3 };',
      );
    });

    it('generates a default value for a date schema with useDates enabled', () => {
      const schemaWithDateDefault: SchemaObject30 = {
        type: 'string',
        format: 'date',
        default: '2025-01-01',
      };

      const dateContext: ContextSpecs = {
        output: {
          override: {
            useDates: true,
          },
        },
      } as ContextSpecs;

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
  });

  describe('enum handling', () => {
    const context: ContextSpecs = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpecs;

    it('generates an enum for a string', () => {
      const schema: SchemaObject30 = {
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

    it('generates an enum for a number', () => {
      const schema: SchemaObject30 = {
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
      const schema: SchemaObject30 = {
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
      const schema: SchemaObject30 = {
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
      const schema: SchemaObject30 = {
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
      const schemaWithEnumArrayDefault: SchemaObject30 = {
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
          ['default', 'testEnumArrayDefaultDefault'],
        ],
        consts: ['export const testEnumArrayDefaultDefault = ["A"] as const;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        "zod.array(zod.enum(['A', 'B', 'C'])).default(testEnumArrayDefaultDefault)",
      );
      expect(parsed.consts).toBe(
        'export const testEnumArrayDefaultDefault = ["A"] as const;',
      );
    });

    it('generates a default value for nested enum arrays in objects', () => {
      const schemaWithNestedEnumArray: SchemaObject30 = {
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
      const someEnumProperty = objectProperties['some_enum'];

      expect(someEnumProperty.consts).toEqual(
        expect.arrayContaining([expect.stringContaining('as const')]),
      );
    });
  });
  describe('number handling', () => {
    const context: ContextSpecs = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpecs;

    it('generates an number', () => {
      const schema: SchemaObject30 = {
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
      const schema: SchemaObject30 = {
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
      const schema: SchemaObject30 = {
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
        const schema: SchemaObject30 & { exclusiveMinimum?: number } = {
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
        const schema: SchemaObject30 & { exclusiveMaximum?: number } = {
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
        const schema: SchemaObject30 & {
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
        const schema: SchemaObject30 = {
          type: 'number',
          minimum: 10,
          exclusiveMinimum: true,
        };

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
        const schema: SchemaObject30 = {
          type: 'number',
          maximum: 100,
          exclusiveMaximum: true,
        };

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
        const schema: SchemaObject30 = {
          type: 'number',
          minimum: 5,
          maximum: 100,
          exclusiveMinimum: true,
          exclusiveMaximum: true,
        };

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
      const schema: SchemaObject30 = {
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
      const schema: SchemaObject30 = {
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
});

const basicApiSchema = {
  pathRoute: '/cats',
  context: {
    specKey: 'cat',
    specs: {
      cat: {
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
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
};
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
          },
        },
      },
      basicApiSchema,
      {},
    );

    expect(result.implementation).toBe(
      'export const testParams = zod.object({\n  "id": zod.string()\n})\n\nexport const testQueryParams = zod.object({\n  "page": zod.number().optional()\n})\n\nexport const testHeader = zod.object({\n  "x-header": zod.string()\n})\n\nexport const testBody = zod.object({\n  "name": zod.string().optional()\n})\n\nexport const testResponse = zod.object({\n  "name": zod.string().optional()\n})\n\n',
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
          },
        },
      },
      basicApiSchema,
      {},
    );
    expect(result.implementation).toBe(
      'export const testResponse = zod.object({\n  "name": zod.string().optional()\n})\n\n',
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
          },
        },
      },
      basicApiSchema,
      {},
    );
    expect(result.implementation).toBe(
      'export const testBody = zod.object({\n  "name": zod.string().optional()\n})\n\n',
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
          },
        },
      },
      basicApiSchema,
      {},
    );
    expect(result.implementation).toBe(
      'export const testQueryParams = zod.object({\n  "page": zod.number().optional()\n})\n\n',
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
          },
        },
      },
      basicApiSchema,
      {},
    );
    expect(result.implementation).toBe(
      'export const testParams = zod.object({\n  "id": zod.string()\n})\n\n',
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
          },
        },
      },
      basicApiSchema,
      {},
    );
    expect(result.implementation).toBe(
      'export const testHeader = zod.object({\n  "x-header": zod.string()\n})\n\n',
    );
  });
});

describe('parsePrefixItemsArrayAsTupleZod', () => {
  it('generates correctly', async () => {
    const arrayWithPrefixItemsSchema: SchemaObject31 = {
      type: 'array',
      prefixItems: [{ type: 'string' }, {}],
      items: { type: 'string' },
    };
    const result = generateZodValidationSchemaDefinition(
      arrayWithPrefixItemsSchema as SchemaObject30,
      {
        output: {
          override: {
            zod: {},
          },
        },
      } as ContextSpecs,
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
  it('correctly omits rest', async () => {
    const arrayWithPrefixItemsSchema: SchemaObject31 = {
      type: 'array',
      prefixItems: [{ type: 'string' }, {}],
      items: { type: 'string' },
      maxItems: 2,
    };
    const result = generateZodValidationSchemaDefinition(
      arrayWithPrefixItemsSchema as SchemaObject30,
      {
        output: {
          override: {
            zod: {},
          },
        },
      } as ContextSpecs,
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
    specKey: 'cat',
    specs: {
      cat: {
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
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
};

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
          },
        },
      },
      formDataSchema,
      {},
    );
    expect(result.implementation).toBe(
      'export const testBody = zod.object({\n  "name": zod.string().optional(),\n  "catImage": zod.instanceof(File).optional()\n})\n\n',
    );
  });
});

const schemaWithRefProperty = {
  pathRoute: '/cats',
  context: {
    specKey: 'cat',
    specs: {
      cat: {
        openapi: '3.0.0',
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
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
};

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
          },
        },
      },
      schemaWithRefProperty,
      {},
    );

    expect(result.implementation).toBe(
      'export const testBody = zod.object({\n  "$ref": zod.string().optional()\n})\n\n',
    );
  });
});

const schemaWithLiteralProperty = {
  pathRoute: '/cats',
  context: {
    specKey: 'cat',
    specs: {
      cat: {
        openapi: '3.0.0',
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
    },
    output: {
      override: {
        zod: {
          generateEachHttpStatus: false,
        },
      },
    },
  },
};

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
          },
        },
      },
      schemaWithLiteralProperty,
      {},
    );

    expect(result.implementation).toBe(
      'export const testBody = zod.object({\n  "type": zod.literal("WILD").optional()\n})\n\n',
    );
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
    } as ContextSpecs;

    // Test case from the issue: type: ["string", "number", "boolean", "null"]
    const schemaWithMultiType: SchemaObject31 = {
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
    } as ContextSpecs;

    const schemaWithMultiType: SchemaObject31 = {
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
    } as ContextSpecs;

    const schemaWithMultiType: SchemaObject31 = {
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
});
