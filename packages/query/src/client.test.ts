import type {
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiSchemaObject,
  PackageJson,
  ResReqTypesValue,
} from '@orval/core';
import {
  GetterPropType,
  getOperationUrlHelperNames,
  OutputHttpClient,
} from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  createTestGeneratorOptions,
  createTestGeneratorVerbOptions,
} from '../../core/src/test-utils';
import {
  generateAngularHttpRequestFunction,
  generateAxiosRequestFunction,
  generateRequestOptionsArguments,
  getHookOptions,
  getHooksOptionImplementation,
  getQueryArgumentsRequestType,
  getQueryHeader,
  getQueryErrorType,
  getQueryOptions,
  getSignalDefinition,
} from './client';
import { createFrameworkAdapter } from './frameworks';

describe('getQueryHeader', () => {
  it('emits filterParams helper for Angular when a non-tagged file has query params', () => {
    const header = getQueryHeader({
      output: { httpClient: OutputHttpClient.ANGULAR },
      verbOptions: {
        listPets: {
          tags: ['pets'],
          queryParams: { schema: { name: 'ListPetsParams' } },
        },
        healthCheck: {
          tags: ['health'],
          queryParams: undefined,
        },
      },
    } as never);

    expect(header).toContain('function filterParams');
  });

  it('does not emit filterParams helper for a tag file with no query params', () => {
    const header = getQueryHeader({
      output: { httpClient: OutputHttpClient.ANGULAR },
      tag: 'health',
      verbOptions: {
        listPets: {
          tags: ['pets'],
          queryParams: { schema: { name: 'ListPetsParams' } },
        },
        healthCheck: {
          tags: ['health'],
          queryParams: undefined,
        },
      },
    } as never);

    expect(header).toBe('');
  });

  it('emits filterParams helper for a tag file whose operations use query params', () => {
    const header = getQueryHeader({
      output: { httpClient: OutputHttpClient.ANGULAR },
      tag: 'pets',
      verbOptions: {
        listPets: {
          tags: ['pets'],
          queryParams: { schema: { name: 'ListPetsParams' } },
        },
        healthCheck: {
          tags: ['health'],
          queryParams: undefined,
        },
      },
    } as never);

    expect(header).toContain('function filterParams');
  });

  it('matches tags using the same normalized pattern as the Angular generator', () => {
    const header = getQueryHeader({
      output: { httpClient: OutputHttpClient.ANGULAR },
      tag: 'pet-status',
      verbOptions: {
        listPetStatus: {
          tags: ['PetStatus', 'pets'],
          queryParams: { schema: { name: 'ListPetStatusParams' } },
        },
      },
    } as never);

    expect(header).toContain('function filterParams');
  });

  it('does not emit filterParams when the current tag is not the first operation tag', () => {
    const header = getQueryHeader({
      output: { httpClient: OutputHttpClient.ANGULAR },
      tag: 'pets',
      verbOptions: {
        healthCheck: {
          tags: ['health', 'pets'],
          queryParams: { schema: { name: 'HealthCheckParams' } },
        },
      },
    } as never);

    expect(header).toBe('');
  });

  it('emits filterParams when the current tag matches the first operation tag among multi-tag operations', () => {
    const header = getQueryHeader({
      output: { httpClient: OutputHttpClient.ANGULAR },
      tag: 'pets',
      verbOptions: {
        healthCheck: {
          tags: ['health', 'pets'],
          queryParams: { schema: { name: 'HealthCheckParams' } },
        },
        listPets: {
          tags: ['pets', 'health'],
          queryParams: { schema: { name: 'ListPetsParams' } },
        },
      },
    } as never);

    expect(header).toContain('function filterParams');
  });
});

describe('getQueryOptions', () => {
  const mockMutator = {
    name: 'customInstance',
    hasSecondArg: true,
    mutatorFn: [],
    hasThirdArg: false,
    isHook: false,
    bodyTypeName: undefined,
    path: '/path/to/mutator.ts',
    default: false,
    hasErrorType: false,
    errorTypeName: '',
  };

  describe('without mutator', () => {
    it('should return fetchOptions without fetcherFn for fetch client by default', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: undefined,
        isExactOptionalPropertyTypes: false,
        hasSignal: false,
        httpClient: OutputHttpClient.FETCH,
      });
      expect(result).toBe('fetchOptions');
    });

    it('should return axiosOptions for axios client', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: undefined,
        isExactOptionalPropertyTypes: false,
        hasSignal: false,
        httpClient: OutputHttpClient.AXIOS,
      });
      expect(result).toBe('axiosOptions');
    });

    it('should wrap signal in object for fetch client with signal without fetcherFn by default', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: undefined,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.FETCH,
      });
      expect(result).toBe('{ signal, ...fetchOptions }');
    });
  });

  describe('with mutator', () => {
    it('should return http and signal for Angular mutator with hasSecondArg', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: mockMutator,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.ANGULAR,
      });
      // Angular mutators need HttpClient passed, not requestOptions
      expect(result).toBe('http, signal');
    });

    it('should return separate requestOptions and signal for axios with mutator', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: mockMutator,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.AXIOS,
      });
      expect(result).toBe('requestOptions, signal');
    });

    it('should return just http when no signal with Angular mutator', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: mockMutator,
        isExactOptionalPropertyTypes: false,
        hasSignal: false,
        httpClient: OutputHttpClient.ANGULAR,
      });
      // Angular mutators need HttpClient passed, not requestOptions
      expect(result).toBe('http');
    });

    it('should return just signal for mutator without hasSecondArg', () => {
      const mutatorNoSecondArg = { ...mockMutator, hasSecondArg: false };
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: mutatorNoSecondArg,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.ANGULAR,
      });
      expect(result).toBe('signal');
    });
  });

  describe('signal handling with mutator vs without', () => {
    it('should return signal as separate arg for Angular mutator case', () => {
      const mutatorNoSecondArg = { ...mockMutator, hasSecondArg: false };
      const result = getQueryOptions({
        isRequestOptions: false,
        mutator: mutatorNoSecondArg,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.ANGULAR,
      });
      expect(result).toBe('signal');
    });

    it('should return signal wrapped in object for non-mutator Angular case', () => {
      const result = getQueryOptions({
        isRequestOptions: false,
        mutator: undefined,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.ANGULAR,
      });
      expect(result).toBe('{ signal }');
    });

    it('should return signal wrapped in object for fetch mutator case', () => {
      const mutatorNoSecondArg = { ...mockMutator, hasSecondArg: false };
      const result = getQueryOptions({
        isRequestOptions: false,
        mutator: mutatorNoSecondArg,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.FETCH,
      });
      expect(result).toBe('{ signal }');
    });

    it('should wrap signal in options for fetch mutator with hasSecondArg', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: mockMutator,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.FETCH,
      });
      expect(result).toBe('{ signal, ...requestOptions }');
    });
  });

  describe('hasSignalParam (API param named "signal")', () => {
    it('should rename AbortSignal to querySignal when API has signal param', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.AXIOS,
        hasSignalParam: true,
      });
      expect(result).toBe('{ signal: querySignal, ...axiosOptions }');
    });

    it('should use querySignal for fetch with signal param conflict without fetcherFn by default', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.FETCH,
        hasSignalParam: true,
      });
      expect(result).toBe('{ signal: querySignal, ...fetchOptions }');
    });

    it('should use querySignal for fetch with signal param conflict and append fetcherFn when useRuntimeFetcher is true', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.FETCH,
        hasSignalParam: true,
        useRuntimeFetcher: true,
      });
      expect(result).toBe(
        '{ signal: querySignal, ...fetchOptions }, fetcherFn',
      );
    });

    it('should use querySignal for axios without request options', () => {
      const result = getQueryOptions({
        isRequestOptions: false,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.AXIOS,
        hasSignalParam: true,
      });
      expect(result).toBe('querySignal');
    });

    it('should use querySignal in wrapped form for fetch without request options', () => {
      const result = getQueryOptions({
        isRequestOptions: false,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.FETCH,
        hasSignalParam: true,
      });
      expect(result).toBe('{ signal: querySignal }');
    });

    it('should use querySignal with exactOptionalPropertyTypes', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        isExactOptionalPropertyTypes: true,
        hasSignal: true,
        httpClient: OutputHttpClient.AXIOS,
        hasSignalParam: true,
      });
      expect(result).toBe(
        '{ ...(querySignal ? { signal: querySignal } : {}), ...axiosOptions }',
      );
    });

    it('should use querySignal for Angular mutator with hasSecondArg', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: mockMutator,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.ANGULAR,
        hasSignalParam: true,
      });
      expect(result).toBe('http, querySignal');
    });

    it('should use querySignal for Axios mutator with hasSecondArg', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: mockMutator,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.AXIOS,
        hasSignalParam: true,
      });
      expect(result).toBe('requestOptions, querySignal');
    });

    it('should use querySignal wrapped for Fetch mutator with hasSecondArg', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        mutator: mockMutator,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.FETCH,
        hasSignalParam: true,
      });
      expect(result).toBe('{ signal: querySignal, ...requestOptions }');
    });
  });
});

describe('getSignalDefinition', () => {
  it('should return signal?: AbortSignal when no conflict', () => {
    const result = getSignalDefinition({
      hasSignal: true,
      hasSignalParam: false,
    });
    expect(result).toBe('signal?: AbortSignal\n');
  });

  it('should return querySignal?: AbortSignal when API has signal param', () => {
    const result = getSignalDefinition({
      hasSignal: true,
      hasSignalParam: true,
    });
    expect(result).toBe('querySignal?: AbortSignal\n');
  });

  it('should return empty string when hasSignal is false', () => {
    const result = getSignalDefinition({
      hasSignal: false,
      hasSignalParam: false,
    });
    expect(result).toBe('');
  });

  it('should return empty string when hasSignal is false even with signal param', () => {
    const result = getSignalDefinition({
      hasSignal: false,
      hasSignalParam: true,
    });
    expect(result).toBe('');
  });
});

describe('generateRequestOptionsArguments with hasSignalParam', () => {
  it('should use querySignal when API has signal param', () => {
    const result = generateRequestOptionsArguments({
      isRequestOptions: false,
      hasSignal: true,
      hasSignalParam: true,
    });
    expect(result).toBe('querySignal?: AbortSignal\n');
  });

  it('should use signal when no conflict', () => {
    const result = generateRequestOptionsArguments({
      isRequestOptions: false,
      hasSignal: true,
      hasSignalParam: false,
    });
    expect(result).toBe('signal?: AbortSignal\n');
  });
});

describe('getQueryArgumentsRequestType - fetcher support', () => {
  it('should not include fetcher type for fetch client by default', () => {
    const result = getQueryArgumentsRequestType(OutputHttpClient.FETCH);
    expect(result).toBe('fetch?: RequestInit');
  });

  it('should include fetcher type for fetch client when useRuntimeFetcher is true', () => {
    const result = getQueryArgumentsRequestType(
      OutputHttpClient.FETCH,
      undefined,
      true,
    );
    expect(result).toBe(
      'fetch?: RequestInit, fetcher?: typeof globalThis.fetch',
    );
  });

  it('should not include fetcher type for axios client', () => {
    const result = getQueryArgumentsRequestType(OutputHttpClient.AXIOS);
    expect(result).toBe('axios?: AxiosRequestConfig');
  });

  it('should not include fetcher type for angular client', () => {
    const result = getQueryArgumentsRequestType(OutputHttpClient.ANGULAR);
    expect(result).toBe('fetch?: RequestInit');
  });

  it('should not include fetcher type when mutator is present', () => {
    const mutator = {
      name: 'customFetch',
      hasSecondArg: true,
      mutatorFn: [],
      hasThirdArg: false,
      isHook: false,
      bodyTypeName: undefined,
      path: '/path/to/mutator.ts',
      default: false,
      hasErrorType: false,
      errorTypeName: '',
    };
    const result = getQueryArgumentsRequestType(
      OutputHttpClient.FETCH,
      mutator,
      true,
    );
    expect(result).toBe('request?: SecondParameter<typeof customFetch>');
  });
});

describe('getHookOptions - fetcher support', () => {
  it('should not extract fetcherFn for fetch client by default', () => {
    const result = getHookOptions({
      isRequestOptions: true,
      httpClient: OutputHttpClient.FETCH,
      mutator: undefined,
    });
    expect(result).toBe(
      'const {query: queryOptions, fetch: fetchOptions} = options ?? {};',
    );
  });

  it('should extract fetcherFn for fetch client when useRuntimeFetcher is true', () => {
    const result = getHookOptions({
      isRequestOptions: true,
      httpClient: OutputHttpClient.FETCH,
      mutator: undefined,
      useRuntimeFetcher: true,
    });
    expect(result).toBe(
      'const {query: queryOptions, fetch: fetchOptions, fetcher: fetcherFn} = options ?? {};',
    );
  });

  it('should not extract fetcherFn for axios client', () => {
    const result = getHookOptions({
      isRequestOptions: true,
      httpClient: OutputHttpClient.AXIOS,
      mutator: undefined,
    });
    expect(result).toBe(
      'const {query: queryOptions, axios: axiosOptions} = options ?? {};',
    );
  });

  it('should not extract fetcherFn for angular client', () => {
    const result = getHookOptions({
      isRequestOptions: true,
      httpClient: OutputHttpClient.ANGULAR,
      mutator: undefined,
    });
    expect(result).toBe(
      'const {query: queryOptions, fetch: fetchOptions} = options ?? {};',
    );
  });

  it('should not extract fetcherFn when isRequestOptions is false', () => {
    const result = getHookOptions({
      isRequestOptions: false,
      httpClient: OutputHttpClient.FETCH,
      mutator: undefined,
    });
    expect(result).toBe('');
  });
});

describe('getQueryOptions - fetcher support', () => {
  it('should not append fetcherFn for fetch client by default', () => {
    const result = getQueryOptions({
      isRequestOptions: true,
      mutator: undefined,
      isExactOptionalPropertyTypes: false,
      hasSignal: false,
      httpClient: OutputHttpClient.FETCH,
    });
    expect(result).toBe('fetchOptions');
  });

  it('should append fetcherFn for fetch client when useRuntimeFetcher is true', () => {
    const result = getQueryOptions({
      isRequestOptions: true,
      mutator: undefined,
      isExactOptionalPropertyTypes: false,
      hasSignal: false,
      httpClient: OutputHttpClient.FETCH,
      useRuntimeFetcher: true,
    });
    expect(result).toBe('fetchOptions, fetcherFn');
  });

  it('should not append fetcherFn for axios client', () => {
    const result = getQueryOptions({
      isRequestOptions: true,
      mutator: undefined,
      isExactOptionalPropertyTypes: false,
      hasSignal: false,
      httpClient: OutputHttpClient.AXIOS,
    });
    expect(result).toBe('axiosOptions');
  });

  it('should not append fetcherFn for angular client without mutator', () => {
    const result = getQueryOptions({
      isRequestOptions: true,
      mutator: undefined,
      isExactOptionalPropertyTypes: false,
      hasSignal: true,
      httpClient: OutputHttpClient.ANGULAR,
    });
    expect(result).toBe('{ signal, ...fetchOptions }');
  });

  it('should append fetcherFn with exactOptionalPropertyTypes for fetch when useRuntimeFetcher is true', () => {
    const result = getQueryOptions({
      isRequestOptions: true,
      mutator: undefined,
      isExactOptionalPropertyTypes: true,
      hasSignal: true,
      httpClient: OutputHttpClient.FETCH,
      useRuntimeFetcher: true,
    });
    expect(result).toBe(
      '{ ...(signal ? { signal } : {}), ...fetchOptions }, fetcherFn',
    );
  });
});

describe('generateAxiosRequestFunction with useDatesTransform', () => {
  const datedSchema: OpenApiSchemaObject = {
    type: 'object',
    required: ['createdAt'],
    properties: { createdAt: { type: 'string', format: 'date-time' } },
  };

  const createSuccessType = (
    overrides: Partial<ResReqTypesValue> = {},
  ): ResReqTypesValue => ({
    value: 'Pet',
    contentType: 'application/json',
    key: '200',
    type: 'object',
    isEnum: false,
    hasReadonlyProps: false,
    imports: [],
    schemas: [],
    isRef: false,
    dependencies: [],
    ...overrides,
  });

  const createResponse = (
    overrides: Partial<GeneratorVerbOptions['response']> = {},
  ): GeneratorVerbOptions['response'] => ({
    imports: [],
    definition: { success: 'Pet', errors: 'unknown' },
    types: {
      success: [createSuccessType({ originalSchema: datedSchema })],
      errors: [],
    },
    contentTypes: ['application/json'],
    isBlob: false,
    schemas: [],
    ...overrides,
  });

  const mutator: GeneratorMutator = {
    name: 'customInstance',
    path: '/path/to/mutator.ts',
    default: false,
    hasErrorType: false,
    errorTypeName: '',
    hasSecondArg: true,
    hasThirdArg: false,
    isHook: false,
  };

  const createVerbOptions = (
    overrides: Parameters<typeof createTestGeneratorVerbOptions>[0] = {},
  ) =>
    createTestGeneratorVerbOptions({
      operationId: 'getPet',
      operationName: 'getPet',
      typeName: 'getPet',
      verb: 'get',
      route: '/pets',
      pathRoute: '/pets',
      response: createResponse(),
      mutator,
      override: {
        requestOptions: true,
        formData: { disabled: true, arrayHandling: 'serialize' },
        formUrlEncoded: true,
        useDatesTransform: true,
      },
      ...overrides,
    });

  const createOptions = (
    overrides: Parameters<typeof createTestGeneratorOptions>[0] = {},
  ): GeneratorOptions =>
    createTestGeneratorOptions({
      route: '/pets',
      pathRoute: '/pets',
      output: '/tmp/pet.ts',
      override: { useDatesTransform: true },
      context: {
        target: 'query-test',
        workspace: '/tmp',
        spec: {
          info: { title: 'Pets', version: '1.0.0' },
        },
        output: {
          urlEncodeParameters: false,
          tsconfig: {},
          optionsParamRequired: false,
        },
      },
      ...overrides,
    });

  const verbOptions = createVerbOptions();
  const options = createOptions();
  const adapter = createFrameworkAdapter({ outputClient: 'react-query' });

  it('appends .then(deserializer) after the mutator call', () => {
    const result = generateAxiosRequestFunction(verbOptions, options, adapter);
    expect(result).toContain(
      'const deserializeGetPetResponse = (data: Pet): Pet =>',
    );
    expect(result).toMatch(/\)\.then\(deserializeGetPetResponse\);/);
    // The deserializer const must come AFTER the operation const so the
    // writer-prepended doc comment stays attached to the operation.
    expect(result.indexOf('const getPet')).toBeLessThan(
      result.indexOf('const deserializeGetPetResponse'),
    );
  });

  it('appends .then(deserializer) after the hook-mutator call', () => {
    const hookVerbOptions = createVerbOptions({
      mutator: { ...mutator, isHook: true },
    });
    const result = generateAxiosRequestFunction(
      hookVerbOptions,
      options,
      adapter,
    );
    expect(result).toContain(
      'const deserializeGetPetResponse = (data: Pet): Pet =>',
    );
    expect(result).toMatch(/\)\.then\(deserializeGetPetResponse\);/);
    expect(result.indexOf('const useGetPetHook')).toBeLessThan(
      result.indexOf('const deserializeGetPetResponse'),
    );
  });

  it('transforms res.data for the plain axios client', () => {
    const result = generateAxiosRequestFunction(
      { ...verbOptions, mutator: undefined },
      options,
      adapter,
    );
    expect(result).toContain(
      '.then((res) => { res.data = deserializeGetPetResponse(res.data); return res; })',
    );
    expect(result.indexOf('const getPet')).toBeLessThan(
      result.indexOf('const deserializeGetPetResponse'),
    );
  });

  it('exports the Axios URL helper without replacing the request call', () => {
    const result = generateAxiosRequestFunction(
      { ...verbOptions, mutator: undefined },
      options,
      adapter,
    );

    expect(result).toContain('export const getGetPetUrl');
    expect(result).toContain('axios.default.create({');
    expect(result).toContain("baseURL: '',");
    expect(result).toContain('params: null,');
    expect(result).toContain('}).getUri({');
    expect(result).toContain('axios.default.get(');
    expect(result).not.toContain('axios.default.get(getGetPetUrl(');
  });

  it('uses the resolved helper name for colliding Axios operations', () => {
    const [fooUrlName, getFooUrlName] = getOperationUrlHelperNames(
      ['foo', 'getFooUrl'],
      ['foo', 'getFooUrl'],
    );
    const foo = generateAxiosRequestFunction(
      {
        ...verbOptions,
        operationName: 'foo',
        urlHelperName: fooUrlName,
        mutator: undefined,
      },
      options,
      adapter,
    );
    const getFoo = generateAxiosRequestFunction(
      {
        ...verbOptions,
        operationName: 'getFooUrl',
        urlHelperName: getFooUrlName,
        mutator: undefined,
      },
      options,
      adapter,
    );

    expect(`${foo}\n${getFoo}`).toContain('export const getFooUrl2');
    expect(`${foo}\n${getFoo}`).toContain('export const getGetFooUrlUrl');
    expect(`${foo}\n${getFoo}`).not.toMatch(/export const getFooUrl\s*=/);
  });

  it('unwraps Vue MaybeRef path values inside the URL helper', () => {
    const vueAdapter = createFrameworkAdapter({ outputClient: 'vue-query' });
    const result = generateAxiosRequestFunction(
      {
        ...verbOptions,
        route: '/pets/${petId}',
        pathRoute: '/pets/{petId}',
        params: [
          {
            name: 'petId',
            definition: 'petId: string',
            implementation: 'petId: string',
            default: undefined,
            required: true,
            imports: [],
          },
        ],
        props: [
          {
            name: 'petId',
            definition: 'petId: string',
            implementation: 'petId: string',
            default: undefined,
            required: true,
            type: 'param',
          },
        ],
        mutator: undefined,
      },
      createOptions({ route: '/pets/${petId}' }),
      vueAdapter,
    );

    expect(result).toContain('export const getGetPetUrl');
    expect(result).toContain('petId: MaybeRef<string>');
    expect(result).toContain('petId = unref(petId);');
  });

  it('uses Vue toValue for MaybeRefOrGetter URL parameters in Query v5', () => {
    const vueAdapter = createFrameworkAdapter({
      outputClient: 'vue-query',
      packageJson: {
        dependencies: { '@tanstack/vue-query': '5.92.7' },
      } as PackageJson,
    });
    const result = generateAxiosRequestFunction(
      {
        ...verbOptions,
        route: '/pets/${petId}',
        pathRoute: '/pets/{petId}',
        params: [
          {
            name: 'petId',
            definition: 'petId: string',
            implementation: 'petId: string',
            default: undefined,
            required: true,
            imports: [],
          },
        ],
        props: [
          {
            name: 'petId',
            definition: 'petId: string',
            implementation: 'petId: string',
            default: undefined,
            required: true,
            type: 'param',
          },
        ],
        mutator: undefined,
      },
      createOptions({ route: '/pets/${petId}' }),
      vueAdapter,
    );

    expect(result).toContain('petId: MaybeRefOrGetter<string>');
    expect(result).toContain('petId = toValue(petId);');
  });

  it('does not unwrap body-only parameters inside the URL helper', () => {
    const vueAdapter = createFrameworkAdapter({ outputClient: 'vue-query' });
    const result = generateAxiosRequestFunction(
      {
        ...verbOptions,
        route: '/pets',
        pathRoute: '/pets',
        props: [
          {
            name: 'createPetsBody',
            definition: 'createPetsBody: CreatePetsBody',
            implementation: 'createPetsBody: CreatePetsBody',
            default: undefined,
            required: true,
            type: 'body',
          },
          {
            name: 'params',
            definition: 'params: CreatePetsParams',
            implementation: 'params: CreatePetsParams',
            default: undefined,
            required: true,
            type: 'queryParam',
          },
        ],
        mutator: undefined,
      },
      createOptions({ route: '/pets' }),
      vueAdapter,
    );

    const helper = result.slice(result.indexOf('export const getGetPetUrl'));
    expect(helper).not.toContain('createPetsBody = toValue(createPetsBody);');
    expect(helper).toContain('params = unref(params);');
  });

  it('does not export a URL helper for Axios mutators', () => {
    const result = generateAxiosRequestFunction(verbOptions, options, adapter);

    expect(result).not.toContain('getGetPetUrl');
  });

  it('emits identical output to today when the flag is off or no dates exist', () => {
    const off = generateAxiosRequestFunction(
      {
        ...verbOptions,
        override: { ...verbOptions.override, useDatesTransform: false },
      },
      options,
      adapter,
    );
    expect(off).not.toContain('deserializeGetPetResponse');

    const dateFree = generateAxiosRequestFunction(
      {
        ...verbOptions,
        response: createResponse({
          types: {
            success: [
              createSuccessType({
                originalSchema: {
                  type: 'object',
                  properties: { name: { type: 'string' } },
                },
              }),
            ],
            errors: [],
          },
        }),
      },
      options,
      adapter,
    );
    expect(dateFree).not.toContain('deserializeGetPetResponse');
    expect(dateFree).not.toContain('.then(');
  });
  const generateCreatePet = (definition: string, petIdType = 'Pet[]Status') =>
    generateAxiosRequestFunction(
      createVerbOptions({
        verb: 'post',
        operationName: 'createPet',
        typeName: 'createPet',
        mutator: { ...mutator, bodyTypeName: 'BodyType' },
        body: {
          ...verbOptions.body,
          definition,
          implementation: 'pet',
          isOptional: false,
        },
        props: [
          {
            name: 'petId',
            definition: `petId: ${petIdType}`,
            implementation: `petId: ${petIdType}`,
            default: undefined,
            required: true,
            type: GetterPropType.PARAM,
          },
          {
            name: 'pet',
            definition: `pet: ${definition}`,
            implementation: `pet: ${definition}`,
            default: undefined,
            required: true,
            type: GetterPropType.BODY,
          },
        ],
      }),
      options,
      adapter,
    );

  it.each([
    ['Pet'],
    ['Pet[]'],
    ['Pet[][]'],
    ['Pet | Cat'],
    ['(Pet | Cat)[]'],
    ["'$1' | 'b'"],
    ["'$&'"],
  ])('wraps a %s body in the mutator BodyType envelope', (definition) => {
    expect(generateCreatePet(definition)).toContain(
      `petId: Pet[]Status,\n    pet: BodyType<${definition}>,\n`,
    );
  });

  it('wraps the body rather than a path param of the same type', () => {
    expect(generateCreatePet('PetStatus', 'PetStatus')).toContain(
      `petId: PetStatus,\n    pet: BodyType<PetStatus>,\n`,
    );
  });

  describe('request body serializer wiring', () => {
    // A realistic JSON body — `implementation`/`definition`/`contentType` are
    // all non-empty and `originalSchema` carries a real `format: date`
    // property — unlike `verbOptions.body` above (whose fields are all `''`
    // so `generateRequestDateSerializer` bails out before ever reaching
    // `bodyForRequest`). `verb: 'put'` is required too: `getIsBodyVerb`
    // excludes 'get', so a body-verb operation is needed to exercise the
    // `data:` wiring at all.
    const datedBody: GeneratorVerbOptions['body'] = {
      implementation: 'appointment',
      definition: 'Appointment',
      imports: [],
      schemas: [],
      originalSchema: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['day'],
              properties: { day: { type: 'string', format: 'date' } },
            },
          },
        },
      },
      contentType: 'application/json',
      formData: '',
      formUrlEncoded: '',
      isOptional: false,
      isBlob: false,
    };

    const dateBodyVerbOptions = createVerbOptions({
      operationName: 'updateAppointment',
      verb: 'put',
      body: datedBody,
    });

    it('serializes the request body before the mutator call', () => {
      const result = generateAxiosRequestFunction(
        dateBodyVerbOptions,
        options,
        adapter,
      );
      expect(result).toContain(
        'data: serializeUpdateAppointmentRequest(appointment)',
      );
      expect(result).toContain(
        'const serializeUpdateAppointmentRequest = (data: Appointment): Appointment =>',
      );
    });

    it('serializes the request body before the plain-axios call', () => {
      const result = generateAxiosRequestFunction(
        { ...dateBodyVerbOptions, mutator: undefined },
        options,
        adapter,
      );
      expect(result).toContain(
        'serializeUpdateAppointmentRequest(appointment)',
      );
      expect(result).toContain(
        'const serializeUpdateAppointmentRequest = (data: Appointment): Appointment =>',
      );
    });

    it('emits the operation const before the serializer implementation, so the writer-prepended JSDoc stays attached to the operation', () => {
      const result = generateAxiosRequestFunction(
        dateBodyVerbOptions,
        options,
        adapter,
      );
      expect(result.indexOf('const updateAppointment')).toBeLessThan(
        result.indexOf('const serializeUpdateAppointmentRequest'),
      );
    });

    it('leaves the body identifier bare when useDatesTransform is disabled', () => {
      const result = generateAxiosRequestFunction(
        {
          ...dateBodyVerbOptions,
          override: {
            ...dateBodyVerbOptions.override,
            useDatesTransform: false,
          },
        },
        options,
        adapter,
      );
      expect(result).not.toContain('serializeUpdateAppointmentRequest');
      expect(result).toContain('data: appointment');
    });

    it('emits no serializer for a body-less verb, even when the body has a JSON date field', () => {
      // GET is excluded from `getIsBodyVerb`, so the body is never wired
      // into `data:` at all — a serializer generated anyway would be an
      // unreferenced `const` that fails a consumer's
      // `noUnusedLocals`/`no-unused-vars` build.
      const result = generateAxiosRequestFunction(
        { ...dateBodyVerbOptions, verb: 'get' },
        options,
        adapter,
      );
      expect(result).not.toContain('serializeUpdateAppointmentRequest');
    });
  });
});

describe('getHooksOptionImplementation', () => {
  it('reads the mutation key from the hoisted getter', () => {
    const implementation = getHooksOptionImplementation(
      true,
      OutputHttpClient.FETCH,
      'getCreatePetsMutationKey',
    );

    expect(implementation).toContain(
      'const mutationKey = getCreatePetsMutationKey();',
    );
  });

  it('emits nothing when request options are disabled', () => {
    expect(
      getHooksOptionImplementation(
        false,
        OutputHttpClient.FETCH,
        'getCreatePetsMutationKey',
      ),
    ).toBe('');
  });
});

describe('generateAngularHttpRequestFunction — zod runtimeValidation response typing (#3941)', () => {
  const makeResponse = (
    successName = 'Pets',
  ): GeneratorVerbOptions['response'] => ({
    definition: { success: successName, errors: 'Error' },
    imports: [{ name: successName, schemaName: successName, values: true }],
    types: {
      success: [
        {
          key: '200',
          contentType: 'application/json',
          value: successName,
          hasReadonlyProps: false,
          imports: [],
          isEnum: false,
          isRef: true,
          schemas: [],
          type: 'object',
          dependencies: [],
        },
      ],
      errors: [],
    },
    contentTypes: ['application/json'],
    schemas: [],
    isBlob: false,
  });

  const makeVerbOptions = (
    overrides: Parameters<typeof createTestGeneratorVerbOptions>[0] = {},
  ) =>
    createTestGeneratorVerbOptions({
      verb: 'get',
      route: '/pets',
      pathRoute: '/pets',
      operationId: 'listPets',
      operationName: 'listPets',
      typeName: 'listPets',
      response: makeResponse(),
      override: {
        requestOptions: false,
        query: {
          runtimeValidation: { enabled: true, strategy: 'throw' },
          shouldExportHttpClient: true,
        },
      },
      ...overrides,
    });

  const makeAngularOptions = (
    schemas: string | { path: string; type: 'zod'; splitByTags: boolean } = {
      path: './model',
      type: 'zod',
      splitByTags: false,
    },
  ) =>
    createTestGeneratorOptions({
      route: '/pets',
      pathRoute: '/pets',
      context: {
        output: {
          schemas: typeof schemas === 'string' ? schemas : schemas,
          httpClient: OutputHttpClient.ANGULAR,
        },
      },
    });

  it('declares the validated response as the zod output alias', () => {
    const implementation = generateAngularHttpRequestFunction(
      makeVerbOptions(),
      makeAngularOptions(),
    );

    expect(implementation).toContain('): Promise<PetsOutput> =>');
    expect(implementation).toContain('http.get<PetsOutput>(url)');
    expect(implementation).toContain('Pets.parse(data)');
    expect(implementation).not.toContain('Promise<Pets>');
  });

  it('references the ErrorSchema value alias for an `Error` response schema', () => {
    const implementation = generateAngularHttpRequestFunction(
      makeVerbOptions({ response: makeResponse('Error') }),
      makeAngularOptions(),
    );

    expect(implementation).toContain('): Promise<ErrorOutput> =>');
    expect(implementation).toContain('http.get<ErrorOutput>(url)');
    expect(implementation).toContain('ErrorSchema.parse(data)');
  });

  it('validates an inline array response through its element schema', () => {
    const response = makeResponse('Item');
    const implementation = generateAngularHttpRequestFunction(
      makeVerbOptions({
        response: {
          ...response,
          definition: { success: 'Item[]', errors: 'Error' },
        },
      }),
      makeAngularOptions(),
    );

    expect(implementation).toContain('): Promise<ItemOutput[]> =>');
    expect(implementation).toContain('http.get<ItemOutput[]>(url)');
    expect(implementation).toContain('zod.array(Item).parse(data)');
  });

  it('keeps the schema (input) type when the schemas output is not zod', () => {
    const implementation = generateAngularHttpRequestFunction(
      makeVerbOptions(),
      makeAngularOptions('./model'),
    );

    expect(implementation).toContain('): Promise<Pets> =>');
    expect(implementation).not.toContain('PetsOutput');
    expect(implementation).not.toContain('.parse(');
  });

  it('keeps the schema (input) type when validation is disabled', () => {
    const verbOptions = makeVerbOptions();
    verbOptions.override.query.runtimeValidation = {
      enabled: false,
      strategy: 'throw',
    };

    const implementation = generateAngularHttpRequestFunction(
      verbOptions,
      makeAngularOptions(),
    );

    expect(implementation).toContain('): Promise<Pets> =>');
    expect(implementation).not.toContain('PetsOutput');
  });
});

describe('getQueryErrorType with response envelopes', () => {
  const errorType = (
    key: string,
  ): GeneratorVerbOptions['response']['types']['errors'][number] => ({
    key,
    value: key === '404' ? 'NotFound' : 'Invalid',
    contentType: 'application/json',
    hasReadonlyProps: false,
    imports: [],
    isEnum: false,
    isRef: false,
    schemas: [],
    type: 'object',
    dependencies: [],
  });

  const response: GeneratorVerbOptions['response'] = {
    imports: [],
    definition: { success: 'Pet', errors: 'NotFound | Invalid' },
    types: { success: [], errors: [errorType('404'), errorType('422')] },
    contentTypes: [],
    isBlob: false,
    schemas: [],
  };
  const mutator = {
    name: 'customInstance',
    path: './mutator.ts',
    default: false,
    hasErrorType: true,
    errorTypeName: '',
    hasSecondArg: false,
    hasThirdArg: false,
    isHook: false,
  } satisfies GeneratorMutator;

  it('keeps body unions by default', () => {
    expect(
      getQueryErrorType(
        'ListPets',
        response,
        OutputHttpClient.FETCH,
        mutator,
        true,
      ),
    ).toBe('ErrorType<NotFound | Invalid>');
  });

  it.each([false, true])(
    'passes the response union with default export %s',
    (isDefault) => {
      expect(
        getQueryErrorType(
          'ListPets',
          response,
          OutputHttpClient.FETCH,
          { ...mutator, default: isDefault },
          true,
          true,
        ),
      ).toBe(`${isDefault ? 'ListPets' : ''}ErrorType<ListPetsResponseError>`);
    },
  );

  it('uses never when no error responses are declared', () => {
    expect(
      getQueryErrorType(
        'Health',
        { ...response, types: { success: [], errors: [] } },
        OutputHttpClient.FETCH,
        mutator,
        true,
        true,
      ),
    ).toBe('ErrorType<never>');
  });

  it('does not change axios error types', () => {
    expect(
      getQueryErrorType(
        'ListPets',
        response,
        OutputHttpClient.AXIOS,
        mutator,
        true,
        true,
      ),
    ).toBe('ErrorType<NotFound | Invalid>');
  });
});
