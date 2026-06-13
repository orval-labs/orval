import { describe, expect, it } from 'vitest';

import { GetterPropType } from '@orval/core';

import {
  getMutationOptionsPathParamNames,
  getMutationOptionsUrl,
} from './mutation-generator';

describe('getMutationOptionsUrl', () => {
  it('keeps static routes unchanged', () => {
    expect(getMutationOptionsUrl('/pets', [])).toBe('/pets');
  });

  it('converts path params to route-pattern placeholders', () => {
    expect(getMutationOptionsUrl('/pets/${petId}', ['petId'])).toBe(
      '/pets/{petId}',
    );
  });

  it('converts embedded path params without referencing scoped variables', () => {
    expect(
      getMutationOptionsUrl('/api/v${version}/entity/${entityId}', [
        'version',
        'entityId',
      ]),
    ).toBe('/api/v{version}/entity/{entityId}');
  });

  it('keeps runtime baseUrl expressions intact', () => {
    expect(
      getMutationOptionsUrl('${getBaseUrl()}/api/v${version}', ['version']),
    ).toBe('${getBaseUrl()}/api/v{version}');
  });

  it('only converts path params in the route suffix when a path route is provided', () => {
    expect(
      getMutationOptionsUrl(
        '${version}/api/v${version}/entity/${entityId}',
        ['version', 'entityId'],
        '/api/v${version}/entity/${entityId}',
      ),
    ).toBe('${version}/api/v{version}/entity/{entityId}');
  });

  it('handles base URLs that remove the path route leading slash', () => {
    expect(
      getMutationOptionsUrl(
        '${getBaseUrl()}api/v${version}/entity/${entityId}',
        ['version', 'entityId'],
        '/api/v${version}/entity/${entityId}',
      ),
    ).toBe('${getBaseUrl()}api/v{version}/entity/{entityId}');
  });

  it('keeps non-path template expressions intact', () => {
    expect(
      getMutationOptionsUrl('/api/${tenant}/entity/${entityId}', ['entityId']),
    ).toBe('/api/${tenant}/entity/{entityId}');
  });
});

describe('getMutationOptionsPathParamNames', () => {
  it('extracts names from destructured named path params', () => {
    expect(
      getMutationOptionsPathParamNames([
        {
          type: GetterPropType.PARAM,
          name: 'petId',
          definition: 'petId: string',
          implementation: 'petId',
          default: undefined,
          required: true,
        },
        {
          type: GetterPropType.NAMED_PATH_PARAMS,
          name: 'params',
          definition: 'params: PathParams',
          implementation:
            '{ version = 1, entityId: entity, ...rest, tenantId }',
          default: false,
          required: true,
          destructured: '{ version = 1, entityId: entity, ...rest, tenantId }',
          schema: {
            name: 'PathParams',
            model: '',
            imports: [],
          },
        },
      ]),
    ).toEqual(['petId', 'version', 'entityId', 'tenantId']);
  });
});
