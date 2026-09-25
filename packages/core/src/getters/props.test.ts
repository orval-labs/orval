import { describe, expect, it } from 'vite-plus/test';

import {
  createTestContextSpec,
  createTestGeneratorVerbOptions,
} from '../test-utils';
import type { GetterQueryParam } from '../types';
import { getProps } from './props';

describe('getProps', () => {
  it('should make props required when optionsParamRequired is true', () => {
    const context = createTestContextSpec({
      output: {
        optionsParamRequired: true,
        allParamsOptional: true,
      },
    });

    const queryParams = {
      schema: {
        name: 'ListPetsParams',
        model: '',
        imports: [],
      },
      deps: [],
      isOptional: true,
    } satisfies GetterQueryParam;

    const props = getProps({
      context,
      queryParams,
      operationName: 'listPets',
      params: [],
      body: createTestGeneratorVerbOptions().body,
    });

    expect(props).toHaveLength(1);
    expect(props[0].type).toBe('queryParam');
    expect(props[0].definition).toMatch('params: ListPetsParams');
    expect(props[0].implementation).toMatch('params: ListPetsParams');
    expect(props[0].required).toBe(true);
  });
  it('should use raw param type for query params definition when client is angular', () => {
    const context = createTestContextSpec({
      output: {
        client: 'angular',
        allParamsOptional: false,
      },
    });

    const queryParams = {
      schema: {
        name: 'ListPetsParams',
        model: '',
        imports: [],
      },
      deps: [],
      isOptional: false,
    } satisfies GetterQueryParam;

    const props = getProps({
      context,
      queryParams,
      operationName: 'listPets',
      params: [],
      body: createTestGeneratorVerbOptions().body,
    });

    expect(props).toHaveLength(1);
    expect(props[0].type).toBe('queryParam');
    expect(props[0].definition).toMatch('params: ListPetsParams');
    expect(props[0].definition).not.toMatch('DeepNonNullable');
    expect(props[0].required).toBe(true);
  });

  it('should preserve null defaults for named path parameters', () => {
    const context = createTestContextSpec({
      output: {
        optionsParamRequired: false,
        allParamsOptional: false,
      },
      override: {
        useNamedParameters: true,
      },
    });

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
      body: createTestGeneratorVerbOptions().body,
    });

    expect(props).toHaveLength(1);
    expect(props[0].type).toBe('namedPathParams');
    expect(props[0].implementation).toContain('version = null');
    expect(props[0].implementation).toContain('}: ListPetsPathParameters = {}');
  });
});
