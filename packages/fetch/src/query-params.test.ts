import type {
  ContextSpec,
  OpenApiParameterObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '@orval/core';
import { PropertySortOrder, Verbs } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../../core/src/test-utils';
import {
  getArrayFormatParameters,
  getDeepObjectParameters,
  getExplodeParameters,
  getParameterObjects,
  hasDateTimeParameter,
  hasDateTimeProperty,
} from './query-params';

type OpenApiParameterLike = OpenApiParameterObject | OpenApiReferenceObject;

type TestParameter = {
  name: string;
  in: string;
  style?: string;
  explode?: boolean;
  // Record keeps widened fixture objects assignable. OpenApiSchemaObject
  // adds JSON Schema booleans, which Record<string, unknown> rejects.
  schema?: OpenApiSchemaObject | Record<string, unknown>;
};

function makeContext(
  parameters: TestParameter[] = [],
  useDates = false,
  schemas?: ContextSpec['output']['schemas'],
): ContextSpec {
  const context = createTestContextSpec({
    spec: {
      paths: {
        '/pets': {
          get: {
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    },
    output: {
      propertySortOrder: PropertySortOrder.ALPHABETICAL,
      ...(schemas === undefined ? {} : { schemas }),
    },
    override: { useDates },
  });
  const operation = context.spec.paths?.['/pets']?.get;
  if (operation) {
    operation.parameters = parameters as OpenApiParameterLike[];
  }
  return context;
}

describe('query-params', () => {
  const arrayParam = (name: string, extra: Partial<TestParameter> = {}) => ({
    name,
    in: 'query',
    schema: { type: 'array', items: { type: 'string' } },
    ...extra,
  });
  const parameterObjects = (parameters: TestParameter[]) => {
    const context = makeContext(parameters);
    return {
      context,
      parameters: getParameterObjects(
        { verb: Verbs.GET },
        { context, pathRoute: '/pets' },
      ),
    };
  };

  it('merges path-item parameters and lets the operation override them', () => {
    const context = createTestContextSpec({
      spec: {
        paths: {
          '/pets': {
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer' } },
              { name: 'X-Trace', in: 'header', schema: { type: 'string' } },
            ],
            get: {
              parameters: [
                { name: 'limit', in: 'query', schema: { type: 'string' } },
                { name: 'x-trace', in: 'header', schema: { type: 'string' } },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      },
    });

    const parameters = getParameterObjects(
      { verb: Verbs.GET },
      { context, pathRoute: '/pets' },
    );

    expect(parameters.map((p) => [p.name, p.in])).toEqual([
      ['limit', 'query'],
      ['x-trace', 'header'],
    ]);
    expect(parameters[0]).toMatchObject({ schema: { type: 'string' } });
  });

  it('selects form-style arrays that explode, deferring unset explode to arrayFormat', () => {
    const { context, parameters } = parameterObjects([
      arrayParam('tags'),
      arrayParam('ids', { explode: false }),
      arrayParam('csv', { style: 'spaceDelimited' }),
      {
        name: 'any',
        in: 'query',
        schema: { oneOf: [{ type: 'string' }, { type: 'array' }] },
      },
      { name: 'q', in: 'query', schema: { type: 'string' } },
    ]);

    expect(
      getExplodeParameters(parameters, undefined, context).map((p) => p.name),
    ).toEqual(['tags', 'any']);
    expect(
      getExplodeParameters(parameters, 'comma', context).map((p) => p.name),
    ).toEqual([]);
  });

  it('selects arrays without an explicit explode only when arrayFormat is set', () => {
    const { context, parameters } = parameterObjects([
      arrayParam('tags'),
      arrayParam('ids', { explode: true }),
    ]);

    expect(
      getArrayFormatParameters(parameters, 'brackets', context).map(
        (p) => p.name,
      ),
    ).toEqual(['tags']);
    expect(getArrayFormatParameters(parameters, undefined, context)).toEqual(
      [],
    );
  });

  it('selects deepObject query parameters', () => {
    const { parameters } = parameterObjects([
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        schema: { type: 'object', properties: { id: { type: 'string' } } },
      },
      { name: 'filter', in: 'query', schema: { type: 'object' } },
    ]);

    expect(getDeepObjectParameters(parameters).map((p) => p.name)).toEqual([
      'scope',
    ]);
  });

  it('detects date-time schemas on parameters and on deepObject properties', () => {
    const { context, parameters } = parameterObjects([
      {
        name: 'since',
        in: 'query',
        schema: { type: 'string', format: 'date-time' },
      },
      {
        name: 'scope',
        in: 'query',
        style: 'deepObject',
        schema: {
          type: 'object',
          properties: { at: { type: 'string', format: 'date-time' } },
        },
      },
    ]);
    const [since, scope] = parameters;

    expect(hasDateTimeParameter([since], context)).toBe(true);
    expect(hasDateTimeParameter([scope], context)).toBe(false);
    expect(hasDateTimeProperty(getDeepObjectParameters([scope]), context)).toBe(
      true,
    );
    expect(hasDateTimeProperty(getDeepObjectParameters([since]), context)).toBe(
      false,
    );
  });
});
