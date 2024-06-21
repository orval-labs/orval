import { describe, expect, it } from 'vitest';
import {
  type ZodValidationSchemaDefinition,
  parseZodValidationSchemaDefinition,
  generateZodValidationSchemaDefinition,
} from '.';
import { SchemaObject } from 'openapi3-ts/oas30';
import { ContextSpecs } from '@orval/core';

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
});
