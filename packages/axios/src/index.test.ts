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

  it('should include axios runtime and AxiosInstance even when global mutator is present', () => {
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
    expect(deps[0].exports).toContainEqual({ name: 'AxiosInstance' });
    // Should NOT include other axios types when mutator is present
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosRequestConfig' });
    expect(deps[0].exports).not.toContainEqual({ name: 'AxiosResponse' });
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

  it('should generate factory function with optional axios parameter when noFunction is false', () => {
    const header = generateAxiosHeader({
      title: 'getPetsApi',
      isRequestOptions: true,
      isMutator: false,
      noFunction: false,
      output: mockOutput,
    });

    expect(header).toContain(
      'export const getPetsApi = (axiosInstance: AxiosInstance = axios)',
    );
  });

  it('should not generate factory function when noFunction is true (axios-functions mode)', () => {
    const header = generateAxiosHeader({
      title: 'getPetsApi',
      isRequestOptions: true,
      isMutator: false,
      noFunction: true,
      output: mockOutput,
    });

    expect(header).not.toContain('export const getPetsApi');
    expect(header).not.toContain('AxiosInstance');
  });

  it('should include SecondParameter type when using mutator with request options', () => {
    const header = generateAxiosHeader({
      title: 'getPetsApi',
      isRequestOptions: true,
      isMutator: true,
      noFunction: false,
      output: mockOutput,
    });

    expect(header).toContain('type SecondParameter<T extends (...args: never)');
    expect(header).toContain(
      'export const getPetsApi = (axiosInstance: AxiosInstance = axios)',
    );
  });
});

describe('generateAxiosTitle', () => {
  it('should generate title with get prefix', () => {
    expect(generateAxiosTitle('pets')).toBe('getPets');
    // pascal() from @orval/core uses specific case conversion
    expect(generateAxiosTitle('swagger-petstore')).toBe('getSwaggerpetstore');
  });
});
