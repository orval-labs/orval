import { OutputHttpClient, OutputHttpClientInjection } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { getReactQueryDependencies } from './dependencies';

describe('getReactQueryDependencies with httpClientInjection', () => {
  const packageJson = {
    dependencies: {
      '@tanstack/react-query': '^5.0.0',
    },
  };

  it('should include AxiosInstance when reactQueryMeta is enabled', () => {
    const deps = getReactQueryDependencies(
      false,
      false,
      packageJson,
      OutputHttpClient.AXIOS,
      false,
      undefined,
      OutputHttpClientInjection.REACT_QUERY_META,
    );

    const axiosDep = deps.find((d) => d.dependency === 'axios');
    const axiosExports = axiosDep?.exports.map((e) => e.name) ?? [];
    expect(axiosExports).toContain('AxiosInstance');
  });

  it('should not include AxiosInstance when injection is none', () => {
    const deps = getReactQueryDependencies(
      false,
      false,
      packageJson,
      OutputHttpClient.AXIOS,
      false,
      undefined,
      OutputHttpClientInjection.NONE,
    );

    const axiosDep = deps.find((d) => d.dependency === 'axios');
    const axiosExports = axiosDep?.exports.map((e) => e.name) ?? [];
    expect(axiosExports).not.toContain('AxiosInstance');
  });

  it('should not include AxiosInstance when httpClient is fetch', () => {
    const deps = getReactQueryDependencies(
      false,
      false,
      packageJson,
      OutputHttpClient.FETCH,
      false,
      undefined,
      OutputHttpClientInjection.REACT_QUERY_META,
    );

    const axiosDep = deps.find((d) => d.dependency === 'axios');
    expect(axiosDep).toBeUndefined();
  });

  it('should not include axios deps when hasGlobalMutator', () => {
    const deps = getReactQueryDependencies(
      true,
      false,
      packageJson,
      OutputHttpClient.AXIOS,
      false,
      undefined,
      OutputHttpClientInjection.REACT_QUERY_META,
    );

    const axiosDep = deps.find((d) => d.dependency === 'axios');
    expect(axiosDep).toBeUndefined();
  });
});
