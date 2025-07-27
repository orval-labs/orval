import { describe, expect, it } from 'vitest';
import { getProps } from './props';
import { ContextSpecs, GetterQueryParam } from '../types';
import { ReferenceObject, RequestBodyObject } from 'openapi3-ts/oas30';

describe('getProps', () => {
  it('should generate DeepNonNullable props for query params type definition when client is angular', () => {
    const context: ContextSpecs = {
      output: {
        client: 'angular',
        allParamsOptional: false,
        override: {},
      },
    } as ContextSpecs;

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
