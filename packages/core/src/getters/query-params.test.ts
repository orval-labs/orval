import { describe, expect, it } from 'vitest';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiParameterObject } from '../types';
import { getQueryParams } from './query-params';

// Fully-typed context via the shared factory — no unsafe cast, so missing
// or renamed fields surface at compile time if getQueryParams starts
// reading additional context. `Filter` backs the $ref test cases below.
const context = createTestContextSpec({
  spec: {
    components: {
      schemas: {
        Filter: {
          type: 'object',
          properties: { field: { type: 'string' } },
        },
      },
    },
  },
  override: {
    useDates: true,
    components: {
      schemas: { suffix: 'Dto', itemSuffix: 'Item' },
      responses: { suffix: 'Response' },
      parameters: { suffix: 'Params' },
      requestBodies: { suffix: 'Body' },
    },
  },
});

const queryParams: {
  parameter: OpenApiParameterObject;
  optional: boolean;
}[] = [
  {
    parameter: {
      name: 'queryParamWithSchemaNotRequired',
      in: 'query',
      schema: {
        type: 'string',
      },
      required: false,
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithSchemaRequired',
      in: 'query',
      schema: {
        type: 'string',
      },
      required: true,
    },
    optional: false,
  },
  {
    parameter: {
      name: 'queryParamWithSchemaDefaultValue',
      in: 'query',
      schema: {
        default: 'defaultValue',
        type: 'string',
      },
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithContentNotRequired',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            type: 'string',
          },
        },
      },
      required: false,
    },
    optional: true,
  },
  {
    parameter: {
      name: 'queryParamWithContentRequired',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            type: 'string',
          },
        },
      },
      required: true,
    },
    optional: false,
  },
  {
    parameter: {
      name: 'queryParamWithContentDefaultValue',
      in: 'query',
      content: {
        'application/json': {
          schema: {
            default: 'defaultValue',
            type: 'string',
          },
        },
      },
      required: true,
    },
    optional: true,
  },
];

describe('getQueryParams getter', () => {
  for (const { parameter, optional } of queryParams) {
    it(`${parameter.name} should${optional ? ' ' : ' NOT '}be optional`, () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter,
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.schema.model.trim()).toBe(
        `export type Params = {\n${parameter.name}${
          optional ? '?' : ''
        }: string;\n};`,
      );
    });
  }

  it('queryParamWithDescription should be documented', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'queryParamWithDescription',
            in: 'query',
            description: 'Parameter description.',
            schema: {
              type: 'string',
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });
    expect(result?.schema.model.trim()).toBe(
      [
        'export type Params = {',
        '/**',
        ' * Parameter description.',
        ' */',
        'queryParamWithDescription?: string;',
        '};',
      ].join('\n'),
    );
  });

  it('queryParam with anyOf and null should be nullable and optional', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'affiliations',
            in: 'query',
            required: false,
            schema: {
              anyOf: [
                {
                  format: 'uuid',
                  type: 'string',
                },
                {
                  type: 'null',
                },
              ],
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.schema.model.trim()).toBe(
      `export type Params = {\naffiliations?: string | null;\n};`,
    );
  });

  it('tracks required nullable keys for downstream generators', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'requiredNullableParam',
            in: 'query',
            required: true,
            schema: {
              type: ['string', 'null'],
            },
          },
          imports: [],
        },
        {
          parameter: {
            name: 'optionalNullableParam',
            in: 'query',
            required: false,
            schema: {
              nullable: true,
              type: 'string',
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.requiredNullableKeys).toEqual(['requiredNullableParam']);
  });

  it('tracks required nullable keys when nullability comes from oneOf', () => {
    const result = getQueryParams({
      queryParams: [
        {
          parameter: {
            name: 'requiredOneOfNullableParam',
            in: 'query',
            required: true,
            schema: {
              oneOf: [
                {
                  type: 'string',
                },
                {
                  type: 'null',
                },
              ],
            },
          },
          imports: [],
        },
      ],
      operationName: '',
      context,
    });

    expect(result?.requiredNullableKeys).toEqual([
      'requiredOneOfNullableParam',
    ]);
  });

  // Tracking non-primitive keys lets Angular generators preserve schema-
  // declared object/array-of-object params through the default filterParams
  // helper instead of silently dropping them. See issue #3326.
  describe('nonPrimitiveKeys (Angular passthrough)', () => {
    it('flags object-typed query params', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'filters',
              in: 'query',
              required: false,
              schema: { type: 'object' },
            },
            imports: [],
          },
          {
            parameter: {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['filters']);
    });

    it('flags arrays of objects', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'items',
              in: 'query',
              required: false,
              schema: {
                type: 'array',
                items: { type: 'object' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['items']);
    });

    it('flags nullable arrays of objects', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'items',
              in: 'query',
              required: false,
              schema: {
                type: ['array', 'null'],
                items: { type: 'object' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['items']);
    });
    it('flags object via oneOf composition', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'either',
              in: 'query',
              required: false,
              schema: {
                oneOf: [{ type: 'string' }, { type: 'object' }],
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['either']);
    });

    it('flags type-less schemas with additionalProperties', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'filters',
              in: 'query',
              required: false,
              schema: {
                additionalProperties: { type: 'string' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['filters']);
    });
    it('omits the field when all params are primitive', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'id',
              in: 'query',
              required: true,
              schema: { type: 'string' },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toBeUndefined();
    });

    it('flags arrays whose items are a $ref', () => {
      // `items` is a reference object, not an inline schema. It almost
      // always points at a component object and must survive the filter
      // (when a paramsSerializer is configured). See #3326.
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'filters',
              in: 'query',
              required: false,
              schema: {
                type: 'array',
                items: { $ref: '#/components/schemas/Filter' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['filters']);
    });

    it('flags arrays without an items schema', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'filters',
              in: 'query',
              required: false,
              schema: {
                type: 'array',
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['filters']);
    });

    it('flags a $ref variant inside a composition', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'either',
              in: 'query',
              required: false,
              schema: {
                oneOf: [
                  { type: 'string' },
                  { $ref: '#/components/schemas/Filter' },
                ],
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toEqual(['either']);
    });

    it('does not flag arrays of primitives', () => {
      const result = getQueryParams({
        queryParams: [
          {
            parameter: {
              name: 'tags',
              in: 'query',
              required: false,
              schema: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            imports: [],
          },
        ],
        operationName: '',
        context,
      });

      expect(result?.nonPrimitiveKeys).toBeUndefined();
    });
  });
});
