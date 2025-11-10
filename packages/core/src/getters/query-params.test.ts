import { describe, expect, it } from 'vitest';

import type { ContextSpec, OpenApiParameterObject } from '../types.ts';
import { getQueryParams } from './query-params.ts';

// Mock context for getQueryParams
const context: ContextSpec = {
  spec: {},
  output: {
    // @ts-expect-error -- partial mock: only override.useDates needed for test
    override: {
      useDates: true,
    },
  },
};

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
});
