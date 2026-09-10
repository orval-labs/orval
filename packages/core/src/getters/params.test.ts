import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { GetterParameters } from '../types';
import { getParams, getParamsInPath } from './params';

const context = createTestContextSpec();

const pathParam = (name: string): GetterParameters['path'][number] => ({
  parameter: { name, in: 'path', required: true, schema: { type: 'string' } },
  imports: [],
});

const pathParamWithDefault = (
  name: string,
  type: string,
  defaultValue: unknown,
): GetterParameters['path'][number] => ({
  parameter: {
    name,
    in: 'path',
    required: true,
    schema: { type, default: defaultValue } as never,
  },
  imports: [],
});

// #3703: params are recognized by the same tokenizer that builds the route, so
// the generated arguments and the route interpolations cannot disagree.
describe('getParamsInPath', () => {
  it('returns the spec spelling of each placeholder', () => {
    expect(getParamsInPath('/pet/{category}/{name}/')).toEqual([
      'category',
      'name',
    ]);
    expect(getParamsInPath('/pet/{scope.id}/{path*}/{pet_id}')).toEqual([
      'scope.id',
      'path*',
      'pet_id',
    ]);
  });

  it('ignores braces that are not a valid parameter name', () => {
    // These stay literal in the generated route, so reporting them as params
    // used to make orval throw on a spec it can generate perfectly well.
    expect(getParamsInPath('/calc/{a+b}/x')).toEqual([]);
    expect(getParamsInPath('/set/{a,b}')).toEqual([]);
    expect(getParamsInPath('/a/{}/x')).toEqual([]);
  });

  it('ignores a `${...}` block written in the spec path', () => {
    expect(getParamsInPath('/foo${petId}')).toEqual([]);
    expect(getParamsInPath('/foo${lit}/{petId}')).toEqual(['petId']);
  });
});

describe('getParams getter', () => {
  it('matches a dotted spec name to its generated identifier in the route', () => {
    const params = getParams({
      pathRoute: '/api/{scope.id}/items',
      pathParams: [pathParam('scope.id')],
      operationId: 'getItems',
      context,
      output: context.output,
    });

    expect(params).toHaveLength(1);
    expect(params[0].name).toBe('scopeId');
    expect(params[0].implementation).toBe('scopeId: string');
  });

  it('throws when a route param has no matching spec parameter', () => {
    expect(() =>
      getParams({
        pathRoute: '/api/{scopeId}',
        pathParams: [pathParam('other')],
        operationId: 'getItems',
        context,
        output: context.output,
      }),
    ).toThrow(
      "The path params scopeId can't be found in parameters (getItems)",
    );
  });

  it('throws when two spec names collide on the same generated identifier', () => {
    expect(() =>
      getParams({
        pathRoute: '/api/{scopeId}',
        pathParams: [pathParam('scope.id'), pathParam('scope_id')],
        operationId: 'getItems',
        context,
        output: context.output,
      }),
    ).toThrow(
      "Path parameters 'scope.id', 'scope_id' all map to the same generated identifier 'scopeId' (getItems). Rename them so they don't collide.",
    );
  });

  it.each([
    ['number', 1, '1'],
    ['number', 0, '0'],
    ['boolean', true, 'true'],
    ['boolean', false, 'false'],
    ['string', 'v1', "'v1'"],
    ['string', '', "''"],
  ])(
    'carries a %s default of %o into the signature',
    (type, defaultValue, rendered) => {
      const params = getParams({
        pathRoute: '/api/{version}/items',
        pathParams: [pathParamWithDefault('version', type, defaultValue)],
        operationId: 'getItems',
        context,
        output: context.output,
      });

      expect(params).toHaveLength(1);
      expect(params[0].default).toBe(defaultValue);
      expect(params[0].definition).toBe(`version?: ${type}`);
      expect(params[0].implementation).toBe(`version: ${type} = ${rendered}`);
    },
  );
});
