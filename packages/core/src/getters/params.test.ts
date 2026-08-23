import { describe, expect, it } from 'vite-plus/test';

import { createTestContextSpec } from '../test-utils/context';
import type { GetterParameters } from '../types';
import { getParams } from './params';

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

describe('getParams getter', () => {
  it('matches a dotted spec name to its generated identifier in the route', () => {
    const params = getParams({
      route: '/api/${scopeId}/items',
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
        route: '/api/${scopeId}',
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
        route: '/api/${scopeId}',
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
        route: '/api/${version}/items',
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
