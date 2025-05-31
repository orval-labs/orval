import { SchemaObject } from 'openapi3-ts/oas30';
import { SchemaObject as SchemaObject31 } from 'openapi3-ts/oas31';
import { describe, expect, it } from 'vitest';
import {
  generateZod,
  generateZodValidationSchemaDefinition,
  parseZodValidationSchemaDefinition,
  type ZodValidationSchemaDefinition,
} from '.';

import { ContextSpecs, GeneratorOptions } from '@orval/core';

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
                functions: [['any', undefined]],
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
  describe('with `override.coerceTypes = false` (default)', () => {
    it('does not emit coerced zod property schemas', () => {
      const parseResult = parseZodValidationSchemaDefinition(
        queryParams,
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
        'zod.object({\n  "limit": zod.number().optional().null(),\n  "q": zod.array(zod.string()).optional()\n})',
      );
    });
  });

  describe('with `override.coerceTypes = true`', () => {
    it('emits coerced zod property schemas', () => {
      const parseResult = parseZodValidationSchemaDefinition(
        queryParams,
        {
          output: {
            override: {
              useDates: false,
            },
          },
        } as ContextSpecs,
        true,
        false,
        false,
      );

      expect(parseResult.zod).toBe(
        'zod.object({\n  "limit": zod.coerce.number().optional().null(),\n  "q": zod.array(zod.coerce.string()).optional()\n})',
      );
    });
  });

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
      'zod.object({\n  "queryParams": zod.record(zod.string(), zod.any())\n})',
    );
  });
});

const objectIntoObjectSchema: SchemaObject = {
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

const deepRequiredSchema: SchemaObject = {
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

const additionalPropertiesSchema: SchemaObject = {
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
                    functions: [['any', undefined]],
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
                    functions: [['any', undefined]],
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

  describe('description handling', () => {
    const context: ContextSpecs = {
      output: {
        override: {
          useDates: false,
        },
      },
    } as ContextSpecs;

    it('generates a description for a parameter', () => {
      const schemaWithDefault: SchemaObject = {
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
      const schemaWithDefault: SchemaObject = {
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
      const schemaWithNumberDefault: SchemaObject = {
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

    it('generates a default value for a boolean schema', () => {
      const schemaWithBooleanDefault: SchemaObject = {
        type: 'boolean',
        default: true,
      };

      const result = generateZodValidationSchemaDefinition(
        schemaWithBooleanDefault,
        context,
        'testBooleanDefault',
        false,
        false,
        { required: false },
      );

      expect(result).toEqual({
        functions: [
          ['boolean', undefined],
          ['default', 'testBooleanDefaultDefault'],
        ],
        consts: ['export const testBooleanDefaultDefault = true;'],
      });

      const parsed = parseZodValidationSchemaDefinition(
        result,
        context,
        false,
        false,
        false,
      );
      expect(parsed.zod).toBe(
        'zod.boolean().default(testBooleanDefaultDefault)',
      );
      expect(parsed.consts).toBe(
        'export const testBooleanDefaultDefault = true;',
      );
    });

    it('generates a default value for an array schema', () => {
      const schemaWithArrayDefault: SchemaObject = {
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
      const schemaWithObjectDefault: SchemaObject = {
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
      const schemaWithDateDefault: SchemaObject = {
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
      const schema: SchemaObject = {
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
      const schema: SchemaObject = {
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
      expect(parsed.zod).toBe('zod.literal(1).or(zod.literal(2)).optional()');
    });

    it('generates an enum for a boolean', () => {
      const schema: SchemaObject = {
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
        'zod.literal(true).or(zod.literal(false)).optional()',
      );
    });

    it('generates an enum for any', () => {
      const schema: SchemaObject = {
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
        "zod.literal('cat').or(zod.literal(1)).or(zod.literal(true)).optional()",
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
      arrayWithPrefixItemsSchema as SchemaObject,
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
              functions: [['any', undefined]],
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
      arrayWithPrefixItemsSchema as SchemaObject,
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
              functions: [['any', undefined]],
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
