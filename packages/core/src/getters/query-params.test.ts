import { describe, expect, it } from 'vitest';

import type { ContextSpec, OpenApiParameterObject } from '../types';
import { getQueryParams } from './query-params';

// Mock context for getQueryParams
const context: ContextSpec = {
  spec: {},
  output: {
    // @ts-expect-error
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
});
