import { ServerObject } from 'openapi3-ts/oas30';
import { describe, expect, it, test } from 'vitest';
import { BaseUrlFromConstant, BaseUrlFromSpec } from '../types';
import { getFullRoute, getRoute, getRouteAsArray } from './route';

describe('getRoute getter', () => {
  [
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
  ].forEach(([input, expected]) => {
    it(`should process ${input} to ${expected}`, () => {
      expect(getRoute(input)).toBe(expected);
    });
  });
});

describe('getFullRoute getter', () => {
  (
    [
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
    ] as [string, ServerObject[] | undefined, BaseUrlFromSpec, string][]
  ).forEach(([path, servers, config, expected]) => {
    it(`should make path ${path} with config ${JSON.stringify(config)} and servers ${JSON.stringify(servers)} be ${expected}`, () => {
      expect(getFullRoute(path, servers, config)).toBe(expected);
    });
  });
  (
    [
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
    ] as [string, ServerObject[] | undefined, BaseUrlFromConstant, string][]
  ).forEach(([path, servers, config, expected]) => {
    it(`should make path ${path} with config ${JSON.stringify(config)} and servers ${JSON.stringify(servers)} be ${expected}`, () => {
      expect(getFullRoute(path, servers, config)).toBe(expected);
    });
  });
  (
    [
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
    ] as [string, ServerObject[] | undefined, BaseUrlFromSpec, string][]
  ).forEach(([path, servers, config, error]) => {
    it(`should throw '${error}' when path ${path} with config ${JSON.stringify(config)} and servers ${JSON.stringify(servers)} is evaluated`, () => {
      expect(() => getFullRoute(path, servers, config)).toThrow(error);
    });
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
