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
  makeRouteSafe,
  wrapRouteParameters,
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

describe('getFullRoute — GHSA-88f2-fpv8-89q2: servers[].url template-literal injection', () => {
  it('escapes backtick in server URL', () => {
    const servers: OpenApiServerObject[] = [
      {
        url: 'http://api.x/`+require("fs").writeFileSync("/marker","pwned")+`',
      },
    ];
    const result = getFullRoute('/path', servers, {
      getBaseUrlFromSpecification: true,
    });
    expect(result).not.toMatch(/(?<!\\)`/);
    expect(result).toContain('\\`+require');
  });

  it('escapes ${ in server URL', () => {
    const servers: OpenApiServerObject[] = [
      {
        url: 'http://api.x/${globalThis.X = require("fs").writeFileSync("/marker","pwned")}/v1',
      },
    ];
    const result = getFullRoute('/path', servers, {
      getBaseUrlFromSpecification: true,
    });
    expect(result).not.toMatch(/(?<!\\)\$\{/);
    expect(result).toContain('\\${globalThis');
  });

  it('escapes backslash in server URL', () => {
    const servers: OpenApiServerObject[] = [
      { url: String.raw`http://api.x/\`+code+\`` },
    ];
    const result = getFullRoute('/path', servers, {
      getBaseUrlFromSpecification: true,
    });
    expect(result).toContain(String.raw`http://api.x/\\\`+code+\\\``);
  });

  it('escapes backtick and ${ in variable default value (spec-sourced)', () => {
    const servers: OpenApiServerObject[] = [
      {
        url: 'http://{env}.example.com',
        variables: {
          env: {
            default:
              '`+require("child_process").execSync("id")+`${globalThis.X}',
          },
        },
      },
    ];
    const result = getFullRoute('/path', servers, {
      getBaseUrlFromSpecification: true,
    });
    expect(result).not.toMatch(/(?<!\\)`/);
    expect(result).not.toMatch(/(?<!\\)\$\{/);
  });
});

describe('getRoute — spec path injection', () => {
  it('escapes backtick in static path segment', () => {
    const result = getRoute('/v1/`+require("child_process").execSync("id")+`');
    expect(result).not.toMatch(/(?<!\\)`/);
  });

  it('does not re-interpret ${...} as a live interpolation', () => {
    // ${evil} in a path is NOT an OpenAPI path param ({param}).
    // jsesc escapes ${ to \${, and getRoutePath must not treat the
    // remaining {evil} as a param — otherwise it re-creates ${evil}.
    for (const payload of [
      '/v1/${evil}/path',
      '/v1/${globalThis.X}/path',
      '/v1/{petId}${evil}/path',
    ]) {
      const result = getRoute(payload);
      expect(result).not.toMatch(/(?<!\\)\$\{evil/);
      expect(result).not.toMatch(/(?<!\\)\$\{globalThis/);
    }
  });

  it('still converts legitimate path params', () => {
    expect(getRoute('/v1/{petId}')).toContain('${petId}');
  });
});

describe('getRouteAsArray — single-quote injection', () => {
  it('escapes single quote in static segment', () => {
    const result = getRouteAsArray("v1/it's/path");
    expect(result).toContain("it\\'s");
  });

  it('escapes single quote in non-interpolation part of mixed segment', () => {
    const result = getRouteAsArray("pre's${petId}");
    expect(result).toContain("pre\\'s");
  });
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

describe('wrapRouteParameters', () => {
  it('wraps parameters correctly', () => {
    const result = wrapRouteParameters(
      '/user/${id}/profile',
      'prefix-',
      '-suffix',
    );
    expect(result).toBe('/user/${prefix-id-suffix}/profile');
  });

  it('handles no parameters gracefully', () => {
    const result = wrapRouteParameters('/user/profile', 'prefix-', '-suffix');
    expect(result).toBe('/user/profile');
  });

  it('handles empty route', () => {
    const result = wrapRouteParameters('', 'prefix-', '-suffix');
    expect(result).toBe('');
  });
});

describe('makeRouteSafe', () => {
  it('encodes URI components in parameters', () => {
    const result = makeRouteSafe('/search/${query}/bla/${something}');
    expect(result).toBe(
      '/search/${encodeURIComponent(String(query))}/bla/${encodeURIComponent(String(something))}',
    );
  });

  it('encodes adjacent parameters separately', () => {
    const result = makeRouteSafe('/x/${a}${b}');
    expect(result).toBe(
      '/x/${encodeURIComponent(String(a))}${encodeURIComponent(String(b))}',
    );
  });

  it('encodes parameters mixed with literal separators', () => {
    const result = makeRouteSafe('/files/${name}.${ext}');
    expect(result).toBe(
      '/files/${encodeURIComponent(String(name))}.${encodeURIComponent(String(ext))}',
    );
  });

  it('handles no special characters gracefully', () => {
    const result = makeRouteSafe('/search/query');
    expect(result).toBe('/search/query');
  });

  it('handles empty route', () => {
    const result = makeRouteSafe('');
    expect(result).toBe('');
  });
});
