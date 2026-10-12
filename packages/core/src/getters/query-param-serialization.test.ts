import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { OpenApiDocument } from '../types';
import { getQueryParamSerialization } from './query-param-serialization';

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

describe('getQueryParamSerialization', () => {
  it('classifies query params the way get<Op>Url serializes them', () => {
    const result = getQueryParamSerialization(
      { pathRoute: '/pets', verb: 'get' },
      context,
    );

    expect(names(result.parameters)).toEqual([
      'limit',
      'shared',
      'ids',
      'tags',
      'filter',
      'X-Trace',
    ]);
    // `form` + the OpenAPI default `explode: true`, including the
    // operation-level `shared` that overrides the path-item one.
    expect(names(result.explode)).toEqual(['shared', 'ids']);
    expect(names(result.arrayFormat)).toEqual([]);
    expect(names(result.deepObject)).toEqual(['filter']);
    expect(result.explodeOnly).toBe(false);
  });

  it('leaves arrays without an explicit explode to arrayFormat', () => {
    const result = getQueryParamSerialization(
      { pathRoute: '/pets', verb: 'get' },
      context,
      'comma',
    );

    expect(names(result.explode)).toEqual([]);
    expect(names(result.arrayFormat)).toEqual(['shared', 'ids']);
  });

  it('reports when every query param is an exploded array', () => {
    expect(
      getQueryParamSerialization(
        { pathRoute: '/arrays-only', verb: 'get' },
        context,
      ).explodeOnly,
    ).toBe(true);
  });

  it('returns nothing for an unknown path', () => {
    const result = getQueryParamSerialization(
      { pathRoute: '/missing', verb: 'get' },
      context,
    );

    expect(result.parameters).toEqual([]);
    expect(result.explodeOnly).toBe(true);
  });
});
