import type {
  ContextSpec,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
  OpenApiSchemaObject,
  ResReqTypesValue,
} from '@orval/core';
import { OutputHttpClient } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createFrameworkAdapter } from './frameworks';
import {
  generateAxiosRequestFunction,
  generateRequestOptionsArguments,
  getHookOptions,
  getQueryArgumentsRequestType,
  getQueryHeader,
  getQueryOptions,
  getSignalDefinition,
} from './client';

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
  ): GeneratorVerbOptions['response'] =>
    ({
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
    }) as GeneratorVerbOptions['response'];

  const createOverride = (
    overrides: Partial<GeneratorVerbOptions['override']> = {},
  ): GeneratorVerbOptions['override'] =>
    ({
      requestOptions: true,
      formData: { disabled: true, arrayHandling: 'serialize' },
      formUrlEncoded: true,
      paramsSerializerOptions: undefined,
      query: {},
      useDatesTransform: true,
      ...overrides,
    }) as GeneratorVerbOptions['override'];

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
    overrides: Partial<GeneratorVerbOptions> = {},
  ): GeneratorVerbOptions =>
    ({
      operationId: 'getPet',
      operationName: 'getPet',
      typeName: 'getPet',
      verb: 'get',
      route: '/pets',
      pathRoute: '/pets',
      tags: [],
      summary: '',
      doc: '',
      response: createResponse(),
      body: {
        implementation: '',
        definition: '',
        imports: [],
        schemas: [],
        originalSchema: { type: 'object' },
        contentType: '',
        formData: '',
        formUrlEncoded: '',
        isOptional: true,
      },
      headers: undefined,
      queryParams: undefined,
      params: [],
      props: [],
      mutator,
      formData: undefined,
      formUrlEncoded: undefined,
      paramsSerializer: undefined,
      fetchReviver: undefined,
      override: createOverride(),
      deprecated: false,
      originalOperation: {} as GeneratorVerbOptions['originalOperation'],
      ...overrides,
    }) as GeneratorVerbOptions;

  const createContext = (): ContextSpec =>
    ({
      target: 'query-test',
      workspace: '/tmp',
      spec: {
        openapi: '3.0.0',
        info: { title: 'Pets', version: '1.0.0' },
        paths: {},
        components: {},
      },
      output: {
        urlEncodeParameters: false,
        tsconfig: {},
        optionsParamRequired: false,
      },
    }) as unknown as ContextSpec;

  const createOptions = (
    overrides: Partial<GeneratorOptions> = {},
  ): GeneratorOptions =>
    ({
      route: '/pets',
      pathRoute: '/pets',
      override: createOverride(),
      context: createContext(),
      output: '/tmp/pet.ts',
      ...overrides,
    }) as GeneratorOptions;

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
});
