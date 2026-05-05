import { describe, expect, it, test } from 'vitest';

import type {
  BaseUrlFromConstant,
  BaseUrlFromSpec,
  BaseUrlRuntime,
  OpenApiServerObject,
} from '../types';
import {
  getBaseUrlRuntimeImports,
  getFullRoute,
  getRoute,
  getRouteAsArray,
} from './route';

describe('getRoute getter', () => {
  for (const [input, expected] of [
    ['/api/test/{id}', '/api/test/${id}'],
    ['/api/test/{path*}', '/api/test/${path}'],
    ['/api/test/{user_id}', '/api/test/${userId}'],
    ['/api/test/{locale}.js', '/api/test/${locale}.js'],
    ['/api/test/i18n-{locale}.js', '/api/test/i18n-${locale}.js'],
    ['/api/test/{param1}-{param2}.js', '/api/test/${param1}-${param2}.js'],
    [
      '/api/test/user{param1}-{param2}.html',
      '/api/test/user${param1}-${param2}.html',
    ],
  ]) {
    it(`should process ${input} to ${expected}`, () => {
      expect(getRoute(input)).toBe(expected);
    });
  }
});

describe('getFullRoute getter', () => {
  for (const [path, servers, config, expected] of [
    [
      '/path',
      [{ url: 'url' }],
      { getBaseUrlFromSpecification: true },
      'url/path',
    ],
    [
      '/path',
      [
        {
          url: '{environment}.example.com',
          variables: {
            environment: {
              default: 'dev',
            },
          },
        },
      ],
      { getBaseUrlFromSpecification: true },
      'dev.example.com/path',
    ],
    [
      '/path',
      [
        {
          url: '{environment}.example.com',
          variables: {
            environment: {
              default: 'dev',
            },
          },
        },
      ],
      {
        getBaseUrlFromSpecification: true,
        variables: { environment: 'prod' },
      },
      'prod.example.com/path',
    ],
    [
      '/path',
      [
        {
          url: '{region}.{environment}.example.com',
          variables: {
            environment: {
              default: 'dev',
            },
            region: {
              default: 'us',
              enum: ['us', 'eu'],
            },
          },
        },
      ],
      {
        getBaseUrlFromSpecification: true,
        variables: { environment: 'prod' },
      },
      'us.prod.example.com/path',
    ],
    [
      '/path',
      [
        {
          url: '{region}.{environment}.example.com',
          variables: {
            environment: {
              default: 'dev',
            },
            region: {
              default: 'us',
              enum: ['us', 'eu'],
            },
          },
        },
      ],
      {
        getBaseUrlFromSpecification: true,
        variables: { environment: 'prod', region: 'eu' },
      },
      'eu.prod.example.com/path',
    ],
  ] as [string, OpenApiServerObject[] | undefined, BaseUrlFromSpec, string][]) {
    it(`should make path ${path} with config ${JSON.stringify(config)} and servers ${JSON.stringify(servers)} be ${expected}`, () => {
      expect(getFullRoute(path, servers, config)).toBe(expected);
    });
  }
  for (const [path, servers, config, expected] of [
    [
      '/path',
      [{ url: 'url' }],
      { getBaseUrlFromSpecification: false, baseUrl: 'api.example.com' },
      'api.example.com/path',
    ],
    [
      '/path',
      undefined,
      { getBaseUrlFromSpecification: false, baseUrl: 'api.example.com' },
      'api.example.com/path',
    ],
  ] as [
    string,
    OpenApiServerObject[] | undefined,
    BaseUrlFromConstant,
    string,
  ][]) {
    it(`should make path ${path} with config ${JSON.stringify(config)} and servers ${JSON.stringify(servers)} be ${expected}`, () => {
      expect(getFullRoute(path, servers, config)).toBe(expected);
    });
  }
  for (const [path, servers, config, expected] of [
    [
      '/pets',
      undefined,
      { runtime: 'process.env.API_BASE_URL' },
      '${process.env.API_BASE_URL}/pets',
    ],
    [
      '/pets',
      undefined,
      { runtime: 'import.meta.env.VITE_API_URL' },
      '${import.meta.env.VITE_API_URL}/pets',
    ],
    [
      '/pets',
      undefined,
      { runtime: 'env.API_BASE_URL' },
      '${env.API_BASE_URL}/pets',
    ],
    ['/path', undefined, { runtime: '' }, '/path'],
  ] as [string, OpenApiServerObject[] | undefined, BaseUrlRuntime, string][]) {
    it(`should make path ${path} with runtime baseUrl ${JSON.stringify(config)} be ${expected}`, () => {
      expect(getFullRoute(path, servers, config)).toBe(expected);
    });
  }
  for (const [path, servers, config, error] of [
    [
      '/path',
      undefined,
      { getBaseUrlFromSpecification: true },
      "Orval is configured to use baseUrl from the specifications 'servers' field, but there exist no servers in the specification.",
    ],
    [
      '/path',
      [
        {
          url: '{region}.example.com',
          variables: {
            region: {
              default: 'us',
              enum: ['us', 'eu'],
            },
          },
        },
      ],
      { getBaseUrlFromSpecification: true, variables: { region: 'euwest' } },
      `Invalid variable value 'euwest' for variable 'region' when resolving {region}.example.com. Valid values are: us, eu.`,
    ],
  ] as [string, OpenApiServerObject[] | undefined, BaseUrlFromSpec, string][]) {
    it(`should throw '${error}' when path ${path} with config ${JSON.stringify(config)} and servers ${JSON.stringify(servers)} is evaluated`, () => {
      expect(() => getFullRoute(path, servers, config)).toThrow(error);
    });
  }
});

describe('getBaseUrlRuntimeImports', () => {
  it('returns [] when baseUrl is omitted', () => {
    expect(getBaseUrlRuntimeImports()).toEqual([]);
  });

  it('returns [] for string baseUrl', () => {
    expect(getBaseUrlRuntimeImports('https://api.example.com')).toEqual([]);
  });

  it('returns [] for BaseUrlFromSpec', () => {
    expect(
      getBaseUrlRuntimeImports({ getBaseUrlFromSpecification: true }),
    ).toEqual([]);
  });

  it('returns [] for BaseUrlFromConstant', () => {
    expect(
      getBaseUrlRuntimeImports({
        getBaseUrlFromSpecification: false,
        baseUrl: 'https://x.com',
      }),
    ).toEqual([]);
  });

  it('returns [] for BaseUrlRuntime without imports', () => {
    expect(getBaseUrlRuntimeImports({ runtime: 'process.env.X' })).toEqual([]);
  });

  it('returns imports for BaseUrlRuntime with imports', () => {
    const imports = [{ name: 'apiBase', importPath: '../config/api' }];
    expect(
      getBaseUrlRuntimeImports({
        runtime: 'apiBase',
        imports,
      }),
    ).toEqual([{ ...imports[0], values: true }]);
  });

  it('returns imports for env object pattern (runtime uses property access)', () => {
    const imports = [{ name: 'env', importPath: '../../env' }];
    expect(
      getBaseUrlRuntimeImports({
        runtime: 'env.API_BASE_URL',
        imports,
      }),
    ).toEqual([{ ...imports[0], values: true }]);
  });

  it('preserves explicit values: false on baseUrl imports', () => {
    const imports = [{ name: 'x', importPath: './x', values: false as const }];
    expect(getBaseUrlRuntimeImports({ runtime: 'x', imports })).toEqual(
      imports,
    );
  });
});

describe('getRouteAsArray getter', () => {
  test.each([
    ['/v${version}/the/nope/${param}', "'v',version,'the','nope',param"],
    ['/${version}/the/${nope}/${param}', "version,'the',nope,param"],
    ['/the/${nope}', "'the',nope"],
    ['/the/nope', "'the','nope'"],
    ['the/nope', "'the','nope'"],
  ])('$1 evals to %2', (input, output) => {
    expect(getRouteAsArray(input)).toEqual(output);
  });
});
