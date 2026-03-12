import { describe, expect, it } from 'vitest';

import type {
  ContextSpec,
  GetterQueryParam,
  OpenApiReferenceObject,
  OpenApiRequestBodyObject,
} from '../types';
import { getProps } from './props';

describe('getProps', () => {
  it('should make props required when optionsParamRequired is true', () => {
    const context: ContextSpec = {
      output: {
        optionsParamRequired: true,
        allParamsOptional: true,
        override: {},
      },
    } as ContextSpec;

    const queryParams: GetterQueryParam = {
      schema: {
        name: 'ListPetsParams',
      },
      isOptional: true,
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
        originalSchema: {} as OpenApiReferenceObject | OpenApiRequestBodyObject,
        imports: [],
        schemas: [],
        contentType: '',
      },
    });

    expect(props).toHaveLength(1);
    expect(props[0].type).toBe('queryParam');
    expect(props[0].definition).toMatch('params: ListPetsParams');
    expect(props[0].implementation).toMatch('params: ListPetsParams');
    expect(props[0].required).toBe(true);
  });
  it('should use raw param type for query params definition when client is angular', () => {
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
        originalSchema: {} as OpenApiReferenceObject | OpenApiRequestBodyObject,
        imports: [],
        schemas: [],
        contentType: '',
      },
    });

    expect(props).toHaveLength(1);
    expect(props[0].type).toBe('queryParam');
    expect(props[0].definition).toMatch('params: ListPetsParams');
    expect(props[0].definition).not.toMatch('DeepNonNullable');
    expect(props[0].required).toBe(true);
  });

  it('should preserve null defaults for named path parameters', () => {
    const context: ContextSpec = {
      output: {
        optionsParamRequired: false,
        allParamsOptional: false,
        override: {
          useNamedParameters: true,
        },
      },
    } as ContextSpec;

    const props = getProps({
      context,
      operationName: 'listPets',
      params: [
        {
          name: 'version',
          definition: 'version?: string | null',
          implementation: 'version?: string | null',
          // eslint-disable-next-line unicorn/no-null -- Regression test for explicit null defaults
          default: null,
          required: false,
          imports: [],
        },
      ],
      body: {
        implementation: '',
        definition: '',
        isOptional: true,
        originalSchema: {} as OpenApiReferenceObject | OpenApiRequestBodyObject,
        imports: [],
        schemas: [],
        contentType: '',
      },
    });

    expect(props).toHaveLength(1);
    expect(props[0].type).toBe('namedPathParams');
    expect(props[0].implementation).toContain('version = null');
    expect(props[0].implementation).toContain('}: ListPetsPathParameters = {}');
  });
});
