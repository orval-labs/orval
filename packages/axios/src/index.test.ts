import { describe, expect, it } from 'vitest';

import {
  generateAxiosHeader,
  generateAxiosTitle,
  getAxiosDependencies,
  getAxiosFactoryDependencies,
} from './index';

describe('getAxiosDependencies (axios-functions mode)', () => {
  it('should return axios runtime import when no global mutator', () => {
    const deps = getAxiosDependencies(false, false);

    expect(deps).toHaveLength(1);
    expect(deps[0].dependency).toBe('axios');
    expect(deps[0].exports).toContainEqual({
      name: 'axios',
      default: true,
      values: true,
      syntheticDefaultImport: true,
    });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosResponse' });
  });

  it('should return empty array when global mutator is present', () => {
    const deps = getAxiosDependencies(true, false);

    expect(deps).toHaveLength(0);
  });

  it('should include qs dependency when params serializer is enabled', () => {
    const deps = getAxiosDependencies(false, true);

    expect(deps).toHaveLength(2);
    expect(deps[1].dependency).toBe('qs');
  });
});

describe('getAxiosFactoryDependencies (axios factory mode)', () => {
  it('should return axios runtime import and AxiosInstance type when no global mutator', () => {
    const deps = getAxiosFactoryDependencies(false, false);

    expect(deps).toHaveLength(1);
    expect(deps[0].dependency).toBe('axios');
    // Should have runtime axios import (for default parameter value)
    expect(deps[0].exports).toContainEqual({
      name: 'axios',
      default: true,
      values: true,
      syntheticDefaultImport: true,
    });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosInstance' });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosResponse' });
  });

  it('should not include AxiosInstance when global mutator is present', () => {
    const deps = getAxiosFactoryDependencies(true, false);

    expect(deps).toHaveLength(1);
    expect(deps[0].dependency).toBe('axios');
    // Should have runtime axios import (for default parameter value)
    expect(deps[0].exports).toContainEqual({
      name: 'axios',
      default: true,
      values: true,
      syntheticDefaultImport: true,
    });
    // Should NOT include AxiosInstance when global mutator is present
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosInstance' });
    // Should NOT include other axios types when mutator is present
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosResponse' });
  });

  it('should not include AxiosInstance when tags mutator is present', () => {
    const deps = getAxiosFactoryDependencies(
      false,
      false,
      undefined,
      undefined,
      true,
    );

    expect(deps).toHaveLength(1);
    expect(deps[0].dependency).toBe('axios');
    // Should have runtime axios import (for default parameter value)
    expect(deps[0].exports).toContainEqual({
      name: 'axios',
      default: true,
      values: true,
      syntheticDefaultImport: true,
    });
    // Should NOT include AxiosInstance when tags mutator is present
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosInstance' });
    // Should still include other axios types since global mutator is not present
    expect(deps[0].exports).toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).toContainEqual({ name: 'AxiosResponse' });
  });

  it('should include qs dependency when params serializer is enabled', () => {
    const deps = getAxiosFactoryDependencies(false, true);

    expect(deps).toHaveLength(2);
    expect(deps[1].dependency).toBe('qs');
  });
});

describe('generateAxiosHeader', () => {
  const mockOutput = {
    tsconfig: {
      compilerOptions: {
        allowSyntheticDefaultImports: true,
      },
    },
  } as never;

  const baseMockParams = {
    title: 'getPetsApi',
    isGlobalMutator: false,
    provideIn: false as const,
    hasAwaitedType: false,
    output: mockOutput,
    verbOptions: {},
    clientImplementation: '',
  };

  it('should generate factory function with optional axios parameter when noFunction is false', () => {
    const header = generateAxiosHeader({
      ...baseMockParams,
      isRequestOptions: true,
      isMutator: false,
      noFunction: false,
    });

    expect(header).toContain(
      'export const getPetsApi = (axiosInstance: AxiosInstance = axios)',
    );
  });

  it('should not generate factory function when noFunction is true (axios-functions mode)', () => {
    const header = generateAxiosHeader({
      ...baseMockParams,
      isRequestOptions: true,
      isMutator: false,
      noFunction: true,
    });

    expect(header).not.toContain('export const getPetsApi');
    expect(header).not.toContain('AxiosInstance');
  });

  it('should include SecondParameter type when using mutator with request options', () => {
    const header = generateAxiosHeader({
      ...baseMockParams,
      isRequestOptions: true,
      isMutator: true,
      noFunction: false,
    });

    expect(header).toContain('type SecondParameter<T extends (...args: never)');
    expect(header).toContain('export const getPetsApi = () => {');
    expect(header).not.toContain('axiosInstance');
  });
});

describe('generateAxiosTitle', () => {
  it('should generate title with get prefix', () => {
    expect(generateAxiosTitle('pets')).toBe('getPets');
    // pascal() from @orval/core uses specific case conversion
    expect(generateAxiosTitle('swagger-petstore')).toBe('getSwaggerpetstore');
  });
});
