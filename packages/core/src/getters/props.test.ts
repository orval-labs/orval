import type { ReferenceObject, RequestBodyObject } from 'openapi3-ts/oas30';
import { describe, expect, it } from 'vitest';

import type { ContextSpec, GetterQueryParam } from '../types';
import { getProps } from './props';

describe('getProps', () => {
  it('should generate DeepNonNullable props for query params type definition when client is angular', () => {
    const context: ContextSpec = {
      output: {
        client: 'angular',
        allParamsOptional: false,
        override: {},
      },
    } as ContextSpec;

    const queryParams: GetterQueryParam = {
      schema: {
        name: 'ListPetsParams',
      },
      isOptional: false,
    } as GetterQueryParam;

    const props = getProps({
      context,
      queryParams,
      operationName: 'listPets',
      params: [],
      body: {
        implementation: '',
        definition: '',
        isOptional: true,
        originalSchema: {} as ReferenceObject | RequestBodyObject,
        imports: [],
        schemas: [],
        contentType: '',
      },
    });

    expect(props).toHaveLength(1);
    expect(props[0].type).toBe('queryParam');
    expect(props[0].definition).toMatch('DeepNonNullable<ListPetsParams>');
    expect(props[0].required).toBe(true);
  });
});
