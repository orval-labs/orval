import type {
  GeneratorOptions,
  GeneratorVerbOptions,
  NormalizedOverrideOutput,
} from '@orval/core';
import { OutputHttpClient, OutputHttpClientInjection } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { builder, generateQueryHeader } from './index';

describe('throws when trying to use named parameters with vue-query client', () => {
  it('vue-query builder type', () => {
    expect(() =>
      builder({ type: 'vue-query' })().client(
        {} as GeneratorVerbOptions,
        {
          override: { useNamedParameters: true } as NormalizedOverrideOutput,
        } as GeneratorOptions,
        'axios',
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686]',
    );
  });
  it('vue-query output client', () => {
    expect(() =>
      builder()().client(
        {} as GeneratorVerbOptions,
        {
          override: { useNamedParameters: true } as NormalizedOverrideOutput,
        } as GeneratorOptions,
        'vue-query',
      ),
    ).toThrowErrorMatchingInlineSnapshot(
      '[Error: vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686]',
    );
  });
});

describe('generateQueryHeader with httpClientInjection', () => {
  const baseParams = {
    hasAwaitedType: true,
    isRequestOptions: false,
    isMutator: false,
    isGlobalMutator: false,
    provideIn: 'root' as const,
    verbOptions: [],
    tag: '',
    clientImplementation: '',
  };

  it('should generate helper functions when reactQueryMeta + axios', () => {
    const result = generateQueryHeader({
      ...baseParams,
      output: {
        httpClient: OutputHttpClient.AXIOS,
        httpClientInjection: OutputHttpClientInjection.REACT_QUERY_META,
      } as never,
    });
    expect(result).toContain('getQueryAxiosInstance');
    expect(result).toContain('getMutationAxiosInstance');
    expect(result).toContain('QueryClient');
    expect(result).toContain('AxiosInstance');
    expect(result).toContain('axios.default');
  });

  it('should not generate helpers when httpClientInjection is none', () => {
    const result = generateQueryHeader({
      ...baseParams,
      output: {
        httpClient: OutputHttpClient.AXIOS,
        httpClientInjection: OutputHttpClientInjection.NONE,
      } as never,
    });
    expect(result).not.toContain('getQueryAxiosInstance');
    expect(result).not.toContain('getMutationAxiosInstance');
  });

  it('should not generate helpers when httpClient is fetch', () => {
    const result = generateQueryHeader({
      ...baseParams,
      output: {
        httpClient: OutputHttpClient.FETCH,
        httpClientInjection: OutputHttpClientInjection.REACT_QUERY_META,
      } as never,
    });
    expect(result).not.toContain('getQueryAxiosInstance');
    expect(result).not.toContain('getMutationAxiosInstance');
  });

  it('should not generate helpers when httpClientInjection is undefined', () => {
    const result = generateQueryHeader({
      ...baseParams,
      output: {
        httpClient: OutputHttpClient.AXIOS,
      } as never,
    });
    expect(result).not.toContain('getQueryAxiosInstance');
  });
});
