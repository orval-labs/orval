import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiDocument } from '../types';
import {
  getArrayFormatParameters,
  getDeepObjectParameters,
  getExplodeParameters,
  getOperationParameters,
  isExplodeOnly,
} from './query-param-serialization';

const spec = {
  openapi: '3.1.0',
  info: { title: 'test', version: '1.0.0' },
  paths: {
    '/pets': {
      parameters: [
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        {
          name: 'shared',
          in: 'query',
          schema: { type: 'string' },
        },
      ],
      get: {
        parameters: [
          {
            name: 'ids',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
          },
          {
            name: 'tags',
            in: 'query',
            explode: false,
            schema: { type: 'array', items: { type: 'string' } },
          },
          {
            name: 'filter',
            in: 'query',
            style: 'deepObject',
            schema: { type: 'object' },
          },
          // Overrides the path-item `shared` with an array.
          {
            name: 'shared',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
          },
          { name: 'X-Trace', in: 'header', schema: { type: 'string' } },
        ],
        responses: {},
      },
    },
    '/arrays-only': {
      get: {
        parameters: [
          {
            name: 'ids',
            in: 'query',
            schema: { type: 'array', items: { type: 'string' } },
          },
        ],
        responses: {},
      },
    },
  },
} as unknown as OpenApiDocument;

const context = createTestContextSpec({ spec });
const names = (parameters: { name: string }[]) =>
  parameters.map((parameter) => parameter.name);

describe('query param serialization', () => {
  const parameters = getOperationParameters(
    { pathRoute: '/pets', verb: 'get' },
    context,
  );

  it('collects the parameters, the operation overriding the path item', () => {
    expect(names(parameters)).toEqual([
      'limit',
      'shared',
      'ids',
      'tags',
      'filter',
      'X-Trace',
    ]);
    expect(
      getOperationParameters({ pathRoute: '/missing', verb: 'get' }, context),
    ).toEqual([]);
  });

  it('classifies query params the way get<Op>Url serializes them', () => {
    // `form` + the OpenAPI default `explode: true`, including the
    // operation-level `shared` that overrides the path-item one.
    const explode = getExplodeParameters(parameters, context);
    const arrayFormat = getArrayFormatParameters(parameters, context);
    const deepObject = getDeepObjectParameters(parameters);

    expect(names(explode)).toEqual(['shared', 'ids']);
    expect(names(arrayFormat)).toEqual([]);
    expect(names(deepObject)).toEqual(['filter']);
    expect(isExplodeOnly(parameters, explode, arrayFormat, deepObject)).toBe(
      false,
    );
  });

  it('leaves arrays without an explicit explode to arrayFormat', () => {
    expect(names(getExplodeParameters(parameters, context, 'comma'))).toEqual(
      [],
    );
    expect(
      names(getArrayFormatParameters(parameters, context, 'comma')),
    ).toEqual(['shared', 'ids']);
  });

  it('reports when every query param is an exploded array', () => {
    const arraysOnly = getOperationParameters(
      { pathRoute: '/arrays-only', verb: 'get' },
      context,
    );

    expect(
      isExplodeOnly(arraysOnly, getExplodeParameters(arraysOnly, context)),
    ).toBe(true);
  });
});
