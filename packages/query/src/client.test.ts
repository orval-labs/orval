import { OutputHttpClient } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  generateRequestOptionsArguments,
  getHttpFunctionQueryProps,
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
          tags: ['PetStatus'],
          queryParams: { schema: { name: 'ListPetStatusParams' } },
        },
      },
    } as never);

    expect(header).toContain('function filterParams');
  });
});

describe('getHttpFunctionQueryProps', () => {
  describe('without mutator (native Angular)', () => {
    it('should prefix with http for Angular httpClient', () => {
      const result = getHttpFunctionQueryProps(
        false,
        OutputHttpClient.ANGULAR,
        'params',
        true,
        false,
      );
      expect(result).toBe('http, params');
    });

    it('should return just http when no query properties for Angular', () => {
      const result = getHttpFunctionQueryProps(
        false,
        OutputHttpClient.ANGULAR,
        '',
        true,
        false,
      );
      expect(result).toBe('http');
    });

    it('should prefix with http when isAngular is true', () => {
      const result = getHttpFunctionQueryProps(
        false,
        OutputHttpClient.AXIOS,
        'params',
        true,
        false,
      );
      expect(result).toBe('http, params');
    });
  });

  describe('with mutator (custom Angular mutator)', () => {
    it('should NOT prefix with http when mutator is used', () => {
      const result = getHttpFunctionQueryProps(
        false,
        OutputHttpClient.ANGULAR,
        'params',
        true,
        true,
      );
      expect(result).toBe('params');
    });

    it('should return empty string when no query properties and mutator is used', () => {
      const result = getHttpFunctionQueryProps(
        false,
        OutputHttpClient.ANGULAR,
        '',
        true,
        true,
      );
      expect(result).toBe('');
    });

    it('should NOT prefix with http even when isAngular is true if mutator is used', () => {
      const result = getHttpFunctionQueryProps(
        false,
        OutputHttpClient.AXIOS,
        'params',
        true,
        true,
      );
      expect(result).toBe('params');
    });
  });

  describe('non-Angular clients', () => {
    it('should return query properties without http prefix for axios', () => {
      const result = getHttpFunctionQueryProps(
        false,
        OutputHttpClient.AXIOS,
        'params',
        false,
        false,
      );
      expect(result).toBe('params');
    });

    it('should return query properties without http prefix for fetch', () => {
      const result = getHttpFunctionQueryProps(
        false,
        OutputHttpClient.FETCH,
        'params',
        false,
        false,
      );
      expect(result).toBe('params');
    });
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
    it('should return fetchOptions for fetch client', () => {
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

    it('should wrap signal in object for fetch client with signal', () => {
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

    it('should use querySignal for fetch with signal param conflict', () => {
      const result = getQueryOptions({
        isRequestOptions: true,
        isExactOptionalPropertyTypes: false,
        hasSignal: true,
        httpClient: OutputHttpClient.FETCH,
        hasSignalParam: true,
      });
      expect(result).toBe('{ signal: querySignal, ...fetchOptions }');
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
