import { mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { mergeDeep, noopReporter, withReporter } from '@orval/core';
import type {
  FormatTypeMap,
  NormalizedSchemaOptions,
  OutputClientFunc,
  OutputMocksConfig,
} from '@orval/core';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import {
  normalizeFormatType,
  normalizeOptions as normalizeOptionsImpl,
} from './options';

const { logWarningSpy } = vi.hoisted(() => ({
  logWarningSpy: vi.fn(),
}));

const normalizeOptions: typeof normalizeOptionsImpl = (...args) =>
  withReporter(
    {
      ...noopReporter,
      warn: (event) => {
        logWarningSpy(event.message);
      },
    },
    () => normalizeOptionsImpl(...args),
  );

const createTempWorkspace = async () => {
  return realpath(await mkdtemp(path.join(os.tmpdir(), 'orval-options-')));
};

describe('normalizeFormatType', () => {
  it('returns undefined for undefined input', () => {
    expect(normalizeFormatType(undefined)).toBeUndefined();
  });

  it('returns empty object for empty config', () => {
    expect(normalizeFormatType({})).toEqual({});
  });

  it('keeps a __proto__ format as an own entry', () => {
    const normalized = normalizeFormatType(
      JSON.parse('{"__proto__": { "type": "Proto" }}') as FormatTypeMap,
    );
    expect(Object.hasOwn(normalized ?? {}, '__proto__')).toBe(true);
    expect(Object.getPrototypeOf(normalized)).toBe(Object.prototype);
  });

  it('throws when type is missing', () => {
    expect(() => normalizeFormatType({ date: { type: '' } })).toThrow(
      'override.formatType.date.type is required',
    );
  });

  it('throws when both codec and transform are set', () => {
    expect(() =>
      normalizeFormatType({
        'date-time': {
          type: 'Dayjs',
          zod: { codec: 'c', transform: 't' },
        },
      }),
    ).toThrow('codec and transform are mutually exclusive');
  });

  it('throws when effect.schema is missing', () => {
    expect(() =>
      normalizeFormatType({
        'date-time': { type: 'Dayjs', effect: { schema: '' } },
      }),
    ).toThrow('override.formatType.date-time.effect.schema is required');
  });

  it('keeps a string factoryDefault and rejects any other', () => {
    expect(
      normalizeFormatType({
        time: { type: 'Temporal.PlainTime', factoryDefault: '00:00' },
      })?.time?.factoryDefault,
    ).toBe('00:00');
    expect(() =>
      normalizeFormatType({
        time: {
          type: 'Temporal.PlainTime',
          factoryDefault: 0 as unknown as string,
        },
      }),
    ).toThrow('override.formatType.time.factoryDefault must be a string');
  });

  it('normalizes the effect schema and its import', () => {
    expect(
      normalizeFormatType({
        'date-time': {
          type: 'Dayjs',
          effect: {
            schema: 'DayjsFromString',
            schemaImport: { name: 'DayjsFromString', importPath: './dayjs' },
          },
        },
      })?.['date-time']?.effect,
    ).toEqual({
      schema: 'DayjsFromString',
      schemaImport: { name: 'DayjsFromString', importPath: './dayjs' },
    });
  });

  it('normalizes decode, encode and their imports', () => {
    expect(
      normalizeFormatType({
        'date-time': {
          type: 'Dayjs',
          decode: 'dayjs',
          decodeImport: { name: 'dayjs', importPath: 'dayjs', default: true },
          encode: 'toIso',
          encodeImport: { name: 'toIso', importPath: './dates' },
        },
      })?.['date-time'],
    ).toMatchObject({
      decode: 'dayjs',
      decodeImport: { name: 'dayjs', importPath: 'dayjs', default: true },
      encode: 'toIso',
      encodeImport: { name: 'toIso', importPath: './dates' },
    });
  });

  it('normalizes imports', () => {
    const result = normalizeFormatType({
      'date-time': {
        type: 'Dayjs',
        import: { name: 'Dayjs', importPath: 'dayjs' },
        zod: {
          transform: 'dayjs',
          transformImport: {
            name: 'dayjs',
            importPath: 'dayjs',
            default: true,
          },
        },
        mock: 'dayjs()',
        mockImport: { name: 'dayjs', importPath: 'dayjs', default: true },
      },
    });

    expect(result?.['date-time']?.type).toBe('Dayjs');
    expect(result?.['date-time']?.import).toEqual({
      name: 'Dayjs',
      importPath: 'dayjs',
    });
    expect(result?.['date-time']?.zod?.transformImport).toEqual({
      name: 'dayjs',
      importPath: 'dayjs',
      default: true,
    });
    expect(result?.['date-time']?.mockImport).toEqual({
      name: 'dayjs',
      importPath: 'dayjs',
      default: true,
    });
  });

  it('handles multiple formats', () => {
    const result = normalizeFormatType({
      date: { type: 'Temporal.PlainDate' },
      'date-time': { type: 'Temporal.Instant' },
      uuid: { type: 'UUID' },
    });

    expect(Object.keys(result ?? {})).toEqual(['date', 'date-time', 'uuid']);
  });

  it('allows transformImport without transform', () => {
    const result = normalizeFormatType({
      date: {
        type: 'Dayjs',
        zod: { transformImport: { name: 'dayjs', importPath: 'dayjs' } },
      },
    });

    expect(result?.date?.zod?.transform).toBeUndefined();
    expect(result?.date?.zod?.transformImport).toEqual({
      name: 'dayjs',
      importPath: 'dayjs',
    });
  });
});

describe('normalizeOptions', () => {
  it('keeps package mutator specifiers as imports', async () => {
    const workspace = await createTempWorkspace();

    try {
      const packageDir = path.join(
        workspace,
        'node_modules',
        '@acme',
        'orval-mutator',
      );
      const validSpecPath = path.join(workspace, 'petstore.yaml');
      const mutatorPath = path.join(packageDir, 'fetch.js');

      await mkdir(packageDir, { recursive: true });
      await writeFile(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@acme/orval-mutator',
          exports: {
            './fetch': './fetch.js',
          },
        }),
      );
      await writeFile(
        mutatorPath,
        'export const customInstance = (config) => config;\n',
      );
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const normalized = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: {
            target: './generated.ts',
            override: {
              mutator: {
                path: '@acme/orval-mutator/fetch',
                name: 'customInstance',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.mutator?.path).toBe(
        '@acme/orval-mutator/fetch',
      );
      expect(normalized.output.override.mutator?.resolvedPath).toBe(
        mutatorPath,
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  describe('tsconfig paths mutator specifiers (#4300)', () => {
    const setup = async (
      paths: Record<string, string[]>,
      compilerOptions: Record<string, unknown> = { baseUrl: '.' },
    ) => {
      const workspace = await createTempWorkspace();
      const validSpecPath = path.join(workspace, 'petstore.yaml');
      const mutatorPath = path.join(workspace, 'src', 'api', 'api-request.ts');

      await mkdir(path.dirname(mutatorPath), { recursive: true });
      await writeFile(
        path.join(workspace, 'tsconfig.json'),
        JSON.stringify({ compilerOptions: { ...compilerOptions, paths } }),
      );
      await writeFile(
        mutatorPath,
        'export const apiRequest = (config: unknown) => config;\n',
      );
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      return { workspace, validSpecPath, mutatorPath };
    };

    it('resolves a bare wildcard alias and keeps it as the import', async () => {
      const { workspace, validSpecPath, mutatorPath } = await setup({
        '*': ['./src/*'],
      });

      try {
        const normalized = await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './src/api/endpoints.ts',
              override: {
                mutator: { path: 'api/api-request', name: 'apiRequest' },
                query: { queryKey: 'api/api-request' },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.mutator).toMatchObject({
          path: 'api/api-request',
          resolvedPath: mutatorPath,
        });
        expect(normalized.output.override.query.queryKey).toMatchObject({
          path: 'api/api-request',
          resolvedPath: mutatorPath,
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('resolves a prefixed alias to the mutator file', async () => {
      const { workspace, validSpecPath, mutatorPath } = await setup({
        '@/*': ['./src/*'],
      });

      try {
        const normalized = await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './src/api/endpoints.ts',
              override: {
                mutator: { path: '@/api/api-request', name: 'apiRequest' },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.mutator).toMatchObject({
          path: '@/api/api-request',
          resolvedPath: mutatorPath,
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('prefers a file relative to the workspace over an alias', async () => {
      const { workspace, validSpecPath, mutatorPath } = await setup({
        '*': ['./src/*'],
      });

      try {
        const normalized = await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './src/api/endpoints.ts',
              override: {
                mutator: { path: 'src/api/api-request.ts', name: 'apiRequest' },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.mutator?.path).toBe(mutatorPath);
        expect(
          normalized.output.override.mutator?.resolvedPath,
        ).toBeUndefined();
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('resolves a .js specifier to its TypeScript source', async () => {
      const { workspace, validSpecPath, mutatorPath } = await setup({
        '@/*': ['./src/*'],
      });

      try {
        // A compiled sibling must not be picked over the source.
        await writeFile(
          mutatorPath.replace(/\.ts$/, '.js'),
          'export const apiRequest = (config) => config;\n',
        );

        const normalized = await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './src/api/endpoints.ts',
              override: {
                mutator: { path: '@/api/api-request.js', name: 'apiRequest' },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.mutator).toMatchObject({
          path: '@/api/api-request.js',
          resolvedPath: mutatorPath,
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('honors a top-level baseUrl on an inline tsconfig', async () => {
      const { workspace, validSpecPath, mutatorPath } = await setup({});

      try {
        const normalized = await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './src/api/endpoints.ts',
              tsconfig: {
                baseUrl: 'src',
                compilerOptions: { paths: { '@/*': ['*'] } },
              },
              override: {
                mutator: { path: '@/api/api-request', name: 'apiRequest' },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.mutator).toMatchObject({
          path: '@/api/api-request',
          resolvedPath: mutatorPath,
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('ignores paths the matcher rejects instead of failing', async () => {
      // Non-relative targets without a `baseUrl` are invalid.
      const { workspace, validSpecPath } = await setup(
        { '@/*': ['src/*'] },
        {},
      );

      try {
        const normalized = await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './src/api/endpoints.ts',
              override: {
                mutator: { path: '@/api/api-request', name: 'apiRequest' },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.mutator).toMatchObject({
          path: '@/api/api-request',
        });
        expect(
          normalized.output.override.mutator?.resolvedPath,
        ).toBeUndefined();
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  });

  it('resolves override.mcp.handler against the workspace', async () => {
    const workspace = await createTempWorkspace();

    try {
      const validSpecPath = path.join(workspace, 'petstore.yaml');
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const normalized = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: {
            target: './src/handlers.ts',
            client: 'mcp',
            override: {
              mcp: {
                handler: {
                  path: './custom-handler.ts',
                  name: 'customHandler',
                },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.mcp).toEqual({
        handler: {
          path: path.join(workspace, 'custom-handler.ts'),
          name: 'customHandler',
          default: false,
        },
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('keeps ESM-only package mutator specifiers as imports', async () => {
    const workspace = await createTempWorkspace();

    try {
      const packageDir = path.join(
        workspace,
        'node_modules',
        '@acme',
        'esm-mutator',
      );
      const validSpecPath = path.join(workspace, 'petstore.yaml');

      await mkdir(packageDir, { recursive: true });
      await writeFile(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: '@acme/esm-mutator',
          type: 'module',
          exports: {
            './fetch': {
              import: './fetch.js',
            },
          },
        }),
      );
      await writeFile(
        path.join(packageDir, 'fetch.js'),
        'export const customInstance = (config) => config;\n',
      );
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const normalized = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: {
            target: './generated.ts',
            override: {
              mutator: {
                path: '@acme/esm-mutator/fetch',
                name: 'customInstance',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.mutator).toMatchObject({
        path: '@acme/esm-mutator/fetch',
      });
      expect(normalized.output.override.mutator?.resolvedPath).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('keeps ESM-only unscoped package subpath mutator specifiers as imports', async () => {
    const workspace = await createTempWorkspace();

    try {
      const packageDir = path.join(workspace, 'node_modules', 'orval-mutator');
      const validSpecPath = path.join(workspace, 'petstore.yaml');

      await mkdir(packageDir, { recursive: true });
      await writeFile(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: 'orval-mutator',
          type: 'module',
          exports: {
            './fetch': {
              import: './fetch.js',
            },
          },
        }),
      );
      await writeFile(
        path.join(packageDir, 'fetch.js'),
        'export const customInstance = (config) => config;\n',
      );
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const normalized = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: {
            target: './generated.ts',
            override: {
              mutator: {
                path: 'orval-mutator/fetch',
                name: 'customInstance',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.mutator).toMatchObject({
        path: 'orval-mutator/fetch',
      });
      expect(normalized.output.override.mutator?.resolvedPath).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('keeps package subpath mutator specifiers when node_modules is above the workspace', async () => {
    const repoRoot = await createTempWorkspace();

    try {
      const workspace = path.join(repoRoot, 'apps', 'api');
      const packageDir = path.join(repoRoot, 'node_modules', 'orval-mutator');
      const validSpecPath = path.join(workspace, 'petstore.yaml');

      await mkdir(packageDir, { recursive: true });
      await mkdir(workspace, { recursive: true });
      await writeFile(
        path.join(packageDir, 'package.json'),
        JSON.stringify({
          name: 'orval-mutator',
          type: 'module',
          exports: {
            './fetch': {
              import: './fetch.js',
            },
          },
        }),
      );
      await writeFile(
        path.join(packageDir, 'fetch.js'),
        'export const customInstance = (config) => config;\n',
      );
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const normalized = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: {
            workspace,
            target: './generated.ts',
            override: {
              mutator: {
                path: 'orval-mutator/fetch',
                name: 'customInstance',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.mutator).toMatchObject({
        path: 'orval-mutator/fetch',
      });
      expect(normalized.output.override.mutator?.resolvedPath).toBeUndefined();
    } finally {
      await rm(repoRoot, { recursive: true, force: true });
    }
  });

  it('keeps exact root-level local mutator files as local paths', async () => {
    const workspace = await createTempWorkspace();

    try {
      const validSpecPath = path.join(workspace, 'petstore.yaml');
      const mutatorPath = path.join(workspace, 'mutator.ts');

      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );
      await writeFile(
        mutatorPath,
        'export const customInstance = (config) => config;\n',
      );

      const normalized = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: {
            target: './generated.ts',
            override: {
              mutator: {
                path: 'mutator.ts',
                name: 'customInstance',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.mutator).toMatchObject({
        path: mutatorPath,
      });
      expect(normalized.output.override.mutator?.resolvedPath).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('keeps unresolved non-relative mutator paths as local workspace paths', async () => {
    const workspace = await createTempWorkspace();

    try {
      const validSpecPath = path.join(workspace, 'petstore.yaml');
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const normalized = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: {
            target: './generated.ts',
            override: {
              mutator: {
                path: 'src/mutator',
                name: 'customInstance',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.mutator).toMatchObject({
        path: path.join(workspace, 'src', 'mutator'),
      });
      expect(normalized.output.override.mutator?.resolvedPath).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('resolves the first existing input target from an input target array', async () => {
    const workspace = await createTempWorkspace();

    try {
      const validSpecPath = path.join(workspace, 'petstore.yaml');
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const normalized = await normalizeOptions(
        {
          input: {
            target: ['./missing.yaml', './petstore.yaml'],
          },
          output: {
            target: './generated.ts',
          },
        },
        workspace,
      );

      expect(normalized.input.target).toBe(validSpecPath);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('resolves the first existing input target from global input arrays', async () => {
    const workspace = await createTempWorkspace();

    try {
      const validSpecPath = path.join(workspace, 'global.yaml');
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const normalized = await normalizeOptions(
        {
          input: './ignored.yaml',
          output: {
            target: './generated.ts',
          },
        },
        workspace,
        {
          input: ['./still-missing.yaml', validSpecPath],
        },
      );

      expect(normalized.input.target).toBe(validSpecPath);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('passes an AbortSignal when probing remote targets and falls back on failure', async () => {
    const workspace = await createTempWorkspace();

    try {
      const validSpecPath = path.join(workspace, 'fallback.yaml');
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const fetchMock = vi.fn<typeof fetch>((_input, init) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal);
        return Promise.reject(new Error('Request failed'));
      });

      vi.stubGlobal('fetch', fetchMock as typeof fetch);

      const normalized = await normalizeOptions(
        {
          input: {
            target: ['https://example.com/openapi.json', './fallback.yaml'],
          },
          output: {
            target: './generated.ts',
          },
        },
        workspace,
      );

      expect(normalized.input.target).toBe(validSpecPath);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('falls back from HEAD to GET when the remote target does not support HEAD', async () => {
    const workspace = await createTempWorkspace();

    try {
      const remoteTarget = 'https://example.com/openapi.json';
      const fetchMock = vi
        .fn<typeof fetch>()
        .mockImplementationOnce((_input, init) => {
          expect(init?.method).toBe('HEAD');
          expect(init?.signal).toBeInstanceOf(AbortSignal);
          return Promise.resolve(new Response(undefined, { status: 405 }));
        })
        .mockImplementationOnce((_input, init) => {
          expect(init?.method).toBe('GET');
          expect(init?.signal).toBeInstanceOf(AbortSignal);
          return Promise.resolve(new Response('{}', { status: 200 }));
        });

      vi.stubGlobal('fetch', fetchMock as typeof fetch);

      const normalized = await normalizeOptions(
        {
          input: {
            target: [remoteTarget],
          },
          output: {
            target: './generated.ts',
          },
        },
        workspace,
      );

      expect(normalized.input.target).toBe(remoteTarget);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes output.operationManifest', async () => {
    const workspace = await createTempWorkspace();
    const normalize = (
      operationManifest: boolean | { path?: string; types?: boolean },
    ) =>
      normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: { target: './generated.ts', operationManifest },
        },
        workspace,
      );

    try {
      expect((await normalize(false)).output.operationManifest).toBeUndefined();
      expect((await normalize(true)).output.operationManifest).toEqual({
        types: true,
      });
      expect(
        (await normalize({ path: './operations.ts', types: false })).output
          .operationManifest,
      ).toEqual({
        path: path.join(workspace, 'operations.ts'),
        types: false,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('defaults angular runtimeValidation to disabled', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.runtimeValidation).toEqual({
        enabled: false,
        strategy: 'throw',
        requestBodies: false,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes angular runtimeValidation.requestBodies globally and per operation', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'angular',
            override: {
              angular: {
                runtimeValidation: { requestBodies: true },
              },
              operations: {
                createPets: {
                  angular: {
                    runtimeValidation: {
                      strategy: 'both',
                      requestBodies: true,
                    },
                  },
                },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.runtimeValidation).toEqual({
        enabled: true,
        strategy: 'throw',
        requestBodies: true,
      });
      expect(
        normalized.output.override.operations.createPets?.angular
          ?.runtimeValidation,
      ).toEqual({ enabled: true, strategy: 'both', requestBodies: true });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes fetch runtimeValidation { strategy: "both" } to the canonical object', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'fetch',
            override: {
              fetch: {
                runtimeValidation: { strategy: 'both' },
              },
            },
          },
        },
        workspace,
      );

      // Guards the spread ordering in normalizeOptions: the raw
      // `...override.fetch` passthrough must not clobber the normalized value.
      expect(normalized.output.override.fetch.runtimeValidation).toEqual({
        enabled: true,
        strategy: 'both',
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('does not enable query runtimeValidation for a per-operation override when the global default is disabled', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'angular',
            override: {
              // Global query runtimeValidation is omitted -> disabled.
              operations: {
                // A per-operation query override that does NOT mention
                // runtimeValidation must inherit the disabled global value, not
                // silently flip it on.
                listPets: {
                  query: { useQuery: true },
                },
              },
            },
          },
        },
        workspace,
      );

      expect(
        normalized.output.override.operations.listPets?.query
          ?.runtimeValidation,
      ).toEqual({ enabled: false, strategy: 'throw' });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes angular retrievalClient as the generated retrieval mode', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              angular: {
                retrievalClient: 'httpResource',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.client).toBe('httpResource');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes the legacy angular client alias for backward compatibility', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              angular: {
                client: 'httpResource',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.client).toBe('httpResource');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('prefers angular retrievalClient over the legacy client alias when both are provided', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              angular: {
                retrievalClient: 'both',
                client: 'httpClient',
              },
              operations: {
                searchPets: {
                  angular: {
                    retrievalClient: 'httpResource',
                    client: 'httpClient',
                  },
                },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.client).toBe('both');
      expect(
        normalized.output.override.operations.searchPets?.angular?.client,
      ).toBe('httpResource');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  describe('override.angular.baseUrl', () => {
    it('normalizes a valid apiId through', async () => {
      const workspace = await createTempWorkspace();

      try {
        const normalized = await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              client: 'angular',
              override: {
                angular: {
                  baseUrl: { apiId: 'example-api' },
                },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.angular.baseUrl).toEqual({
          apiId: 'example-api',
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('carries through index and variables', async () => {
      const workspace = await createTempWorkspace();

      try {
        const normalized = await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              client: 'angular',
              override: {
                angular: {
                  baseUrl: {
                    apiId: 'example-api',
                    index: 1,
                    variables: { port: '8080' },
                  },
                },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.angular.baseUrl).toEqual({
          apiId: 'example-api',
          index: 1,
          variables: { port: '8080' },
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('throws for an invalid apiId', async () => {
      const workspace = await createTempWorkspace();

      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                client: 'angular',
                override: {
                  angular: {
                    baseUrl: { apiId: '1-not-valid' },
                  },
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(/apiId/);
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('throws when combined with the top-level output.baseUrl', async () => {
      const workspace = await createTempWorkspace();

      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                client: 'angular',
                baseUrl: 'https://example.com',
                override: {
                  angular: {
                    baseUrl: { apiId: 'example-api' },
                  },
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(/output\.baseUrl/);
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('throws when combined with an empty-string output.baseUrl', async () => {
      const workspace = await createTempWorkspace();

      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                client: 'angular',
                baseUrl: '',
                override: {
                  angular: {
                    baseUrl: { apiId: 'example-api' },
                  },
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(/output\.baseUrl/);
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('warns when configured for a non-Angular client', async () => {
      const workspace = await createTempWorkspace();
      logWarningSpy.mockClear();

      try {
        await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              client: 'axios',
              override: {
                angular: {
                  baseUrl: { apiId: 'example-api' },
                },
              },
            },
          },
          workspace,
        );

        expect(logWarningSpy).toHaveBeenCalled();
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('warns and drops a per-operation angular.baseUrl override', async () => {
      const workspace = await createTempWorkspace();
      logWarningSpy.mockClear();

      try {
        const normalized = await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              client: 'angular',
              override: {
                angular: { baseUrl: { apiId: 'example-api' } },
                operations: {
                  searchPets: {
                    angular: { baseUrl: { apiId: 'other-api' } } as never,
                  },
                },
              },
            },
          },
          workspace,
        );

        expect(logWarningSpy).toHaveBeenCalled();
        expect(
          normalized.output.override.operations.searchPets?.angular,
        ).not.toHaveProperty('baseUrl');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  });

  it('defaults angular queryObjectSerialization to spec (issue #3705)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.queryObjectSerialization).toBe(
        'spec',
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('keeps only explicit query docs fields on tag and operation overrides (#4399)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              query: { docs: { route: true } },
              tags: {
                pets: { query: { docs: { route: false } } },
              },
              operations: {
                listPets: { query: { useInfinite: true } },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.query.docs).toEqual({ route: true });
      expect(normalized.output.override.tags.pets?.query?.docs).toEqual({
        route: false,
      });
      // Not copied from the output level, so the later output → tag →
      // operation merge keeps the tag's `route: false`.
      expect(
        normalized.output.override.operations.listPets?.query?.docs,
      ).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes an explicit angular queryObjectSerialization: legacy override', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              angular: {
                queryObjectSerialization: 'legacy',
              },
              operations: {
                searchPets: {
                  angular: {
                    queryObjectSerialization: 'legacy',
                  },
                },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.queryObjectSerialization).toBe(
        'legacy',
      );
      expect(
        normalized.output.override.operations.searchPets?.angular
          ?.queryObjectSerialization,
      ).toBe('legacy');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  // KNOWN LIMITATION (shared with `retrievalClient`/`runtimeValidation`,
  // pre-existing before #3705): setting ANY per-operation `angular` field
  // re-defaults the other angular fields to their global fallbacks at the
  // `override.operations[op].angular` normalization step below, rather than
  // inheriting the global value. The deep-merge that later combines this
  // normalized per-operation block with the global `override.angular` (in
  // `@orval/core`'s `generators/verbs-options.ts`) therefore overwrites a
  // global non-default `client`/`queryObjectSerialization` with this
  // re-defaulted value for that one operation. This test documents the
  // current (unfixed) behavior at the normalization boundary this package
  // owns — see plan risks for issue #3705.
  it('re-defaults sibling angular fields to their global fallback when only one per-operation angular field is set', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              angular: {
                retrievalClient: 'httpResource',
              },
              operations: {
                searchPets: {
                  angular: {
                    queryObjectSerialization: 'legacy',
                  },
                },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.client).toBe('httpResource');
      expect(
        normalized.output.override.operations.searchPets?.angular
          ?.queryObjectSerialization,
      ).toBe('legacy');
      // Documents the limitation: the per-operation block re-defaults
      // `client` to `'httpClient'` instead of inheriting the global
      // `'httpResource'`.
      expect(
        normalized.output.override.operations.searchPets?.angular?.client,
      ).toBe('httpClient');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('does not re-default angular observeOverloads on per-operation overrides (issue #4289)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              angular: {
                observeOverloads: false,
              },
              operations: {
                searchPets: {
                  angular: {
                    queryObjectSerialization: 'legacy',
                  },
                },
                showPet: {
                  angular: {
                    observeOverloads: true,
                  },
                },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.angular.observeOverloads).toBe(false);
      // Omitted per-operation value stays unset so the deep merge keeps the
      // global `false`.
      expect(
        normalized.output.override.operations.searchPets?.angular,
      ).not.toHaveProperty('observeOverloads');
      expect(
        normalized.output.override.operations.showPet?.angular
          ?.observeOverloads,
      ).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('falls back to the global angular provideIn on tag overrides that omit it (issue #4425)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              angular: {
                provideIn: 'any',
              },
              tags: {
                Public: {
                  angular: {
                    provideIn: false,
                  },
                },
                Users: {
                  angular: {
                    queryObjectSerialization: 'legacy',
                  },
                },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.tags.Public?.angular?.provideIn).toBe(
        false,
      );
      expect(normalized.output.override.tags.Users?.angular?.provideIn).toBe(
        'any',
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  describe('override.tags keys that resolve to the same tag bucket', () => {
    const normalizeWithTags = async (
      client: 'angular' | 'fetch',
      mode: 'single' | 'tags' | 'tags-split' | 'tags-operations',
    ) => {
      const workspace = await createTempWorkspace();

      try {
        return await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              client,
              mode,
              override: {
                tags: {
                  'Pet Store': { angular: { provideIn: false } },
                  'pet-store': { angular: { provideIn: 'root' } },
                },
              },
            },
          },
          workspace,
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    };

    it.each(['tags', 'tags-split', 'tags-operations'] as const)(
      'rejects them for the angular client in %s mode',
      async (mode) => {
        await expect(normalizeWithTags('angular', mode)).rejects.toThrow(
          /`override\.tags\["Pet Store"\]` and `override\.tags\["pet-store"\]` both resolve to the "pet-store" tag/,
        );
      },
    );

    it('accepts them outside tag modes', async () => {
      await expect(
        normalizeWithTags('angular', 'single'),
      ).resolves.toBeDefined();
    });

    it('accepts them for other clients', async () => {
      await expect(normalizeWithTags('fetch', 'tags')).resolves.toBeDefined();
    });
  });

  it('normalizes schemas: false to undefined', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: false,
          },
        },
        workspace,
      );

      expect(normalized.output.schemas).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it.each([
    ['./model/schemas.ts', 'schemas.path'],
    ['./model/schemas.tsx', 'schemas.path'],
    ['./model/schemas.mjs', 'schemas.path'],
  ])('rejects %s as schemas.path, which names a file', async (path) => {
    const workspace = await createTempWorkspace();

    try {
      // The path is a directory: a filename silently became a directory with
      // that name, holding the split schema files (#4042).
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: { path, type: 'zod' },
            },
          },
          workspace,
        ),
      ).rejects.toThrow(/names a file/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects a filename given in the string form of schemas', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: { target: './generated.ts', schemas: './model/schemas.ts' },
          },
          workspace,
        ),
      ).rejects.toThrow(/`schemas` is a directory/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('accepts a directory whose name merely contains a dot', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: { path: './model/v1.0', type: 'zod' },
          },
        },
        workspace,
      );

      expect(normalized.output.schemas).toBeDefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('accepts a file-like schemas.path in single mode and keeps it verbatim', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './model/schemas.zod.ts',
              type: 'zod',
              mode: 'single',
            },
          },
        },
        workspace,
      );

      const normalizedSchemas = normalized.output.schemas as
        | NormalizedSchemaOptions
        | undefined;
      expect(normalizedSchemas?.path).toBe(
        path.resolve(workspace, 'model/schemas.zod.ts'),
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('keeps rejecting a file-like schemas.path in split mode even with type zod', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './model/schemas.zod.ts',
                type: 'zod',
                mode: 'split',
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow(/names a file/);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('preserves schemas.importPath through normalization', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './models',
              type: 'typescript',
              importPath: '@acme/models',
            },
          },
        },
        workspace,
      );

      expect(normalized.output.schemas).toEqual({
        path: expect.any(String) as string,
        type: 'typescript',
        importPath: '@acme/models',
        splitByTags: false,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes schema routes relative to the schema base path', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './schemas',
              routes: { default: 'models', enum: 'types' },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.schemas).toEqual({
        path: path.join(workspace, 'schemas'),
        type: 'typescript',
        splitByTags: false,
        routes: { default: 'models', enum: 'types' },
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes dot segments in schema routes', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './schemas',
              routes: {
                default: './models/./domain',
                enum: 'types/./enums',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.schemas).toMatchObject({
        routes: { default: 'models/domain', enum: 'types/enums' },
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('requires a default schema route', async () => {
    const workspace = await createTempWorkspace();

    await expect(
      normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './schemas',
              routes: {} as never,
            },
          },
        },
        workspace,
      ),
    ).rejects.toThrow('`schemas.routes.default` is required');

    await rm(workspace, { recursive: true, force: true });
  });

  it.each([
    ['', 'empty'],
    ['/absolute', 'absolute'],
    ['../outside', 'escaping'],
    ['C:/absolute', 'Windows absolute'],
    ['//server/share', 'UNC absolute'],
    ['.', 'empty after normalization'],
  ])('rejects %s schema route paths (%s)', async (route) => {
    const workspace = await createTempWorkspace();

    await expect(
      normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './schemas',
              routes: { default: route },
            },
          },
        },
        workspace,
      ),
    ).rejects.toThrow('`schemas.routes.default` must be a relative directory');

    await rm(workspace, { recursive: true, force: true });
  });

  it('rejects duplicate default and enum schema routes', async () => {
    const workspace = await createTempWorkspace();

    await expect(
      normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './schemas',
              routes: { default: 'models', enum: 'models' },
            },
          },
        },
        workspace,
      ),
    ).rejects.toThrow('must be different directories');

    await rm(workspace, { recursive: true, force: true });
  });

  it.each([
    ['models/.', 'dot segment'],
    ['Models', 'case-insensitive'],
  ])('rejects equivalent schema routes (%s: %s)', async (enumRoute) => {
    const workspace = await createTempWorkspace();

    await expect(
      normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './schemas',
              routes: { default: 'models', enum: enumRoute },
            },
          },
        },
        workspace,
      ),
    ).rejects.toThrow('must be different directories');

    await rm(workspace, { recursive: true, force: true });
  });

  it('rejects unsupported schema route combinations before generation', async () => {
    const workspace = await createTempWorkspace();
    const baseInput = {
      input: {
        target: {
          openapi: '3.1.0',
          info: { title: 'Test', version: '1.0.0' },
          paths: {},
        },
      },
      output: {
        target: './generated.ts',
        schemas: {
          path: './schemas',
          routes: { default: 'models' },
        },
      },
    };

    const zodOptions = await normalizeOptions(
      {
        ...baseInput,
        output: {
          ...baseInput.output,
          schemas: {
            ...baseInput.output.schemas,
            type: 'zod',
          },
        },
      },
      workspace,
    );
    expect(zodOptions.output.schemas).toMatchObject({
      type: 'zod',
      routes: { default: 'models' },
    });

    const splitByTagsOptions = await normalizeOptions(
      {
        ...baseInput,
        output: {
          ...baseInput.output,
          schemas: {
            ...baseInput.output.schemas,
            splitByTags: true,
          },
        },
      },
      workspace,
    );
    expect(splitByTagsOptions.output.schemas).toMatchObject({
      splitByTags: true,
      routes: { default: 'models' },
    });

    await expect(
      normalizeOptions(
        {
          ...baseInput,
          output: {
            ...baseInput.output,
            operationSchemas: './operation-schemas',
          },
        },
        workspace,
      ),
    ).rejects.toThrow('cannot be used with `output.operationSchemas`');

    await rm(workspace, { recursive: true, force: true });
  });

  it('rejects route-aware schema imports for mocks and factories', async () => {
    const workspace = await createTempWorkspace();
    const baseInput = {
      input: {
        target: {
          openapi: '3.1.0',
          info: { title: 'Test', version: '1.0.0' },
          paths: {},
        },
      },
      output: {
        target: './generated.ts',
        schemas: {
          path: './schemas',
          routes: { default: 'models' },
        },
      },
    };

    await expect(
      normalizeOptions(
        { ...baseInput, output: { ...baseInput.output, mock: true } },
        workspace,
      ),
    ).rejects.toThrow('cannot be used with mock generators');

    await expect(
      normalizeOptions(
        {
          ...baseInput,
          output: {
            ...baseInput.output,
            factoryMethods: { outputDirectory: './factories' },
          },
        },
        workspace,
      ),
    ).rejects.toThrow('cannot be used with `output.factoryMethods`');

    await rm(workspace, { recursive: true, force: true });
  });

  it('normalizes zod/effect exactOptional (default false, opt-in true)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const input = {
        target: {
          openapi: '3.1.0',
          info: { title: 'Test', version: '1.0.0' },
          paths: {},
        },
      };

      const defaults = await normalizeOptions(
        { input, output: { target: './generated.ts' } },
        workspace,
      );
      expect(defaults.output.override.zod.exactOptional).toBe(false);
      expect(defaults.output.override.effect.exactOptional).toBe(false);

      const enabled = await normalizeOptions(
        {
          input,
          output: {
            target: './generated.ts',
            override: {
              zod: { exactOptional: true },
              effect: { exactOptional: true },
            },
          },
        },
        workspace,
      );
      expect(enabled.output.override.zod.exactOptional).toBe(true);
      expect(enabled.output.override.effect.exactOptional).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes includeZodSchemaInArguments (default false, opt-in true)', async () => {
    const workspace = await createTempWorkspace();

    try {
      const input = {
        target: {
          openapi: '3.1.0',
          info: { title: 'Test', version: '1.0.0' },
          paths: {},
        },
      };

      const defaults = await normalizeOptions(
        { input, output: { target: './generated.ts' } },
        workspace,
      );
      expect(defaults.output.override.includeZodSchemaInArguments).toBe(false);

      const enabled = await normalizeOptions(
        {
          input,
          output: {
            target: './generated.ts',
            override: { includeZodSchemaInArguments: true },
          },
        },
        workspace,
      );
      expect(enabled.output.override.includeZodSchemaInArguments).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('defaults schemas.type to typescript when omitted', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: {
              path: './models',
              importPath: '@acme/models',
            },
          },
        },
        workspace,
      );

      expect(normalized.output.schemas).toEqual({
        path: expect.any(String) as string,
        type: 'typescript',
        importPath: '@acme/models',
        splitByTags: false,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects a relative path as schemas.importPath', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: './models',
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow('`schemas.importPath` must be a package specifier');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects an empty string as schemas.importPath', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: '',
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow(
        '`schemas.importPath` must be a non-empty package specifier',
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects a parent-relative path as schemas.importPath', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: '../models',
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow('`schemas.importPath` must be a package specifier');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects an absolute path as schemas.importPath', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: '/abs/models',
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow('not an absolute path');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects a Windows drive-letter absolute path as schemas.importPath', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: String.raw`C:\models`,
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow('not an absolute path');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects a Windows UNC path as schemas.importPath', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: String.raw`\\server\share\models`,
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow('not an absolute path');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects a whitespace-only string as schemas.importPath', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: '   ',
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow('whitespace-only string');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('rejects leading/trailing whitespace in schemas.importPath', async () => {
    const workspace = await createTempWorkspace();

    try {
      await expect(
        normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: '  @acme/models  ',
              },
            },
          },
          workspace,
        ),
      ).rejects.toThrow('leading or trailing whitespace');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  describe('faker schemasImportPath validation', () => {
    it('rejects a relative path as schemasImportPath', async () => {
      const workspace = await createTempWorkspace();

      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                schemas: {
                  path: './models',
                  type: 'typescript',
                  importPath: '@acme/models',
                },
                mock: {
                  generators: [
                    {
                      type: 'faker',
                      schemas: true,
                      schemasImportPath: './fakers',
                    },
                  ],
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(
          '`mock.generators[faker].schemasImportPath` must be a package specifier',
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects an empty string as schemasImportPath', async () => {
      const workspace = await createTempWorkspace();

      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                schemas: {
                  path: './models',
                  type: 'typescript',
                  importPath: '@acme/models',
                },
                mock: {
                  generators: [
                    {
                      type: 'faker',
                      schemas: true,
                      schemasImportPath: '',
                    },
                  ],
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(
          '`mock.generators[faker].schemasImportPath` must be a non-empty package specifier',
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects an absolute path as schemasImportPath', async () => {
      const workspace = await createTempWorkspace();

      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                schemas: {
                  path: './models',
                  type: 'typescript',
                  importPath: '@acme/models',
                },
                mock: {
                  generators: [
                    {
                      type: 'faker',
                      schemas: true,
                      schemasImportPath: '/abs/fakers',
                    },
                  ],
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(
          '`mock.generators[faker].schemasImportPath` must be a package specifier',
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects schemasImportPath when schemas.importPath is not set', async () => {
      const workspace = await createTempWorkspace();

      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                schemas: {
                  path: './models',
                  type: 'typescript',
                },
                mock: {
                  generators: [
                    {
                      type: 'faker',
                      schemas: true,
                      schemasImportPath: '@acme/models/fakers',
                    },
                  ],
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(
          '`mock.generators[faker].schemasImportPath` requires `schemas.importPath` or `schemasPath` to also be set',
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects schemasImportPath when schemas: true is not set on the faker generator', async () => {
      const workspace = await createTempWorkspace();

      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                schemas: {
                  path: './models',
                  type: 'typescript',
                  importPath: '@acme/models',
                },
                mock: {
                  generators: [
                    {
                      type: 'faker',
                      schemasImportPath: '@acme/models/fakers',
                    },
                  ],
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(
          '`mock.generators[faker].schemasImportPath` requires `schemas: true`',
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('accepts a valid schemasImportPath when schemas.importPath is set', async () => {
      const workspace = await createTempWorkspace();

      try {
        const normalized = await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              schemas: {
                path: './models',
                type: 'typescript',
                importPath: '@acme/models',
              },
              mock: {
                generators: [
                  {
                    type: 'faker',
                    schemas: true,
                    schemasImportPath: '@acme/models/fakers',
                  },
                ],
              },
            },
          },
          workspace,
        );

        const fakerGenerator = normalized.output.mock.generators[0] as {
          schemasImportPath?: string;
        };
        expect(fakerGenerator.schemasImportPath).toBe('@acme/models/fakers');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  });

  describe('mock.fixtures validation', () => {
    const normalizeMock = (
      mock: Omit<OutputMocksConfig, 'generators'> & {
        generators: readonly { type: 'faker' | 'msw' }[];
      },
    ) =>
      normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            mock: { ...mock, generators: [...mock.generators] },
          },
        },
        process.cwd(),
      );

    it('accepts fixtures with a faker generator and indexMockFiles', async () => {
      const normalized = await normalizeMock({
        fixtures: true,
        indexMockFiles: true,
        generators: [{ type: 'faker' }],
      });
      expect(normalized.output.mock.fixtures).toBe(true);
    });

    it.each([
      [{ indexMockFiles: true, generators: [{ type: 'msw' }] }],
      [{ generators: [{ type: 'faker' }] }],
      [{ indexMockFiles: true, inline: true, generators: [{ type: 'faker' }] }],
    ] as const)(
      'rejects fixtures without a faker mock index (%o)',
      async (mock) => {
        await expect(
          normalizeMock({ fixtures: true, ...mock }),
        ).rejects.toThrow('`mock.fixtures` requires a faker generator');
      },
    );
  });

  describe('faker schemasPath and importPath validation', () => {
    const normalizeFaker = (
      workspace: string,
      faker: Record<string, unknown>,
      output: Record<string, unknown> = {},
    ) =>
      normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            schemas: './models',
            mock: { generators: [{ type: 'faker', ...faker }] },
            ...output,
          },
        },
        workspace,
      );

    it('resolves schemasPath against the workspace', async () => {
      const workspace = await createTempWorkspace();
      try {
        const normalized = await normalizeFaker(workspace, {
          schemas: true,
          schemasPath: './mocks/faker/schemas',
        });
        const faker = normalized.output.mock.generators[0] as {
          schemasPath?: string;
        };
        expect(faker.schemasPath).toBe(
          path.join(workspace, 'mocks/faker/schemas'),
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('accepts schemasImportPath with schemasPath and no schemas.importPath', async () => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeFaker(workspace, {
            schemas: true,
            schemasPath: './mocks/faker/schemas',
            schemasImportPath: '@acme/mocks/faker/schemas',
          }),
        ).resolves.toBeDefined();
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects schemasPath without schemas: true', async () => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeFaker(workspace, { schemasPath: './mocks/faker/schemas' }),
        ).rejects.toThrow('requires `schemas: true`');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects schemasPath without output.schemas', async () => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeFaker(
            workspace,
            { schemas: true, schemasPath: './mocks/faker/schemas' },
            { schemas: undefined },
          ),
        ).rejects.toThrow('requires `output.schemas`');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects schemasPath equal to the faker path when indexMockFiles is on', async () => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeFaker(
            workspace,
            {},
            {
              mock: {
                indexMockFiles: true,
                generators: [
                  {
                    type: 'faker',
                    path: './mocks/faker',
                    schemas: true,
                    schemasPath: './mocks/faker',
                  },
                ],
              },
            },
          ),
        ).rejects.toThrow('cannot be the faker `path`');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects importPath without indexMockFiles', async () => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeFaker(workspace, { importPath: '@acme/mocks/faker' }),
        ).rejects.toThrow(
          '`mock.generators[faker].importPath` requires `mock.indexMockFiles: true`',
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('rejects a relative importPath', async () => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeFaker(workspace, { importPath: '../faker' }),
        ).rejects.toThrow(
          '`mock.generators[faker].importPath` must be a package specifier',
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  });

  it('defaults zod dateTimeOptions to { offset: true } so RFC3339 offset values are accepted', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'zod',
          },
        },
        workspace,
      );

      expect(normalized.output.override.zod.dateTimeOptions).toEqual({
        offset: true,
      });
      expect(normalized.output.override.zod.timeOptions).toEqual({});
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('preserves user-provided zod dateTimeOptions without merging defaults', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'zod',
            override: {
              zod: {
                dateTimeOptions: { precision: 3 },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.zod.dateTimeOptions).toEqual({
        precision: 3,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('defaults generateReusableSchemas to false', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'zod',
          },
        },
        workspace,
      );

      expect(normalized.output.override.zod.generateReusableSchemas).toBe(
        false,
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('defaults zod variant to classic and preserves mini when configured output-wide', async () => {
    const workspace = await createTempWorkspace();

    try {
      const classic = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './classic.ts',
            client: 'zod',
          },
        },
        workspace,
      );
      const mini = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './mini.ts',
            client: 'zod',
            override: {
              zod: {
                variant: 'mini',
              },
            },
          },
        },
        workspace,
      );

      expect(classic.output.override.zod.variant).toBe('classic');
      expect(mini.output.override.zod.variant).toBe('mini');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('resolves global zod mutators relative to the output workspace', async () => {
    const workspace = await createTempWorkspace();

    try {
      const outputWorkspace = path.join(workspace, 'generated');
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './api.ts',
            workspace: './generated',
            client: 'zod',
            override: {
              zod: {
                preprocess: {
                  param: './param.ts',
                  query: './query.ts',
                  header: './header.ts',
                  body: './body.ts',
                  response: './response.ts',
                },
                params: './params.ts',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.zod.preprocess).toMatchObject({
        param: { path: path.join(outputWorkspace, 'param.ts') },
        query: { path: path.join(outputWorkspace, 'query.ts') },
        header: { path: path.join(outputWorkspace, 'header.ts') },
        body: { path: path.join(outputWorkspace, 'body.ts') },
        response: { path: path.join(outputWorkspace, 'response.ts') },
      });
      expect(normalized.output.override.zod.params?.path).toBe(
        path.join(outputWorkspace, 'params.ts'),
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('warns and strips output-only zod fields from operation and tag overrides', async () => {
    const workspace = await createTempWorkspace();
    logWarningSpy.mockClear();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'zod',
            override: {
              operations: {
                listPets: {
                  zod: {
                    strict: { body: true },
                    version: 3,
                    variant: 'mini',
                    exactOptional: true,
                  } as never,
                },
              },
              tags: {
                Pets: {
                  zod: {
                    generate: { response: false },
                    generateMeta: true,
                  } as never,
                },
              },
            },
          },
        },
        workspace,
      );

      expect(logWarningSpy).toHaveBeenCalledWith(
        expect.stringContaining('override.operations.listPets.zod'),
      );
      expect(logWarningSpy).toHaveBeenCalledWith(
        expect.stringContaining('override.tags.Pets.zod'),
      );
      expect(
        'version' in
          (normalized.output.override.operations.listPets?.zod ?? {}),
      ).toBe(false);
      expect(
        'variant' in
          (normalized.output.override.operations.listPets?.zod ?? {}),
      ).toBe(false);
      expect(logWarningSpy).toHaveBeenCalledWith(
        expect.stringContaining('zod.exactOptional'),
      );
      expect(
        'exactOptional' in
          (normalized.output.override.operations.listPets?.zod ?? {}),
      ).toBe(false);
      expect(
        'generateMeta' in (normalized.output.override.tags.Pets?.zod ?? {}),
      ).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      logWarningSpy.mockClear();
    }
  });

  it('emits no zod object for operation/tag overrides that only carry unsupported fields', async () => {
    const workspace = await createTempWorkspace();
    logWarningSpy.mockClear();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'zod',
            override: {
              operations: {
                listPets: {
                  zod: {
                    version: 3,
                  } as never,
                },
              },
              tags: {
                Pets: {
                  zod: {
                    generateMeta: true,
                  } as never,
                },
              },
            },
          },
        },
        workspace,
      );

      // An unsupported-only entry must be a true no-op: no normalized zod
      // object is emitted, so default strict/generate/coerce values can't leak
      // in and override global `override.zod.*` during downstream merges.
      expect(
        normalized.output.override.operations.listPets?.zod,
      ).toBeUndefined();
      expect(normalized.output.override.tags.Pets?.zod).toBeUndefined();
    } finally {
      await rm(workspace, { recursive: true, force: true });
      logWarningSpy.mockClear();
    }
  });

  it('honors generateCompanionTypes as a supported per-operation zod override', async () => {
    const workspace = await createTempWorkspace();
    logWarningSpy.mockClear();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'zod',
            override: {
              zod: {
                generateCompanionTypes: false,
              },
              operations: {
                listPets: {
                  zod: {
                    generateCompanionTypes: true,
                  },
                },
              },
            },
          },
        },
        workspace,
      );

      expect(logWarningSpy).not.toHaveBeenCalled();
      expect(normalized.output.override.zod.generateCompanionTypes).toBe(false);
      expect(
        normalized.output.override.operations.listPets?.zod
          ?.generateCompanionTypes,
      ).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
      logWarningSpy.mockClear();
    }
  });

  it('resolves global query mutators relative to the output workspace', async () => {
    const workspace = await createTempWorkspace();

    try {
      const outputWorkspace = path.join(workspace, 'generated');
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './api.ts',
            workspace: './generated',
            client: 'react-query',
            override: {
              query: {
                queryKey: './queryKey.ts',
                queryOptions: './queryOptions.ts',
                mutationOptions: './mutationOptions.ts',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.query).toMatchObject({
        queryKey: { path: path.join(outputWorkspace, 'queryKey.ts') },
        queryOptions: { path: path.join(outputWorkspace, 'queryOptions.ts') },
        mutationOptions: {
          path: path.join(outputWorkspace, 'mutationOptions.ts'),
        },
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('normalizes effect options without falling back to zod', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'effect',
            override: {
              zod: {
                strict: { body: true },
                useBrandedTypes: true,
              },
              effect: {
                strict: { response: true },
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.effect.strict.response).toBe(true);
      expect(normalized.output.override.effect.strict.body).toBe(false);
      expect(normalized.output.override.effect.useBrandedTypes).toBe(false);
      expect(normalized.output.override.effect.version).toBe('auto');
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('keeps global valibot settings when an operation override sets only some', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            client: 'valibot',
            override: {
              valibot: { exactOptional: true, generate: { body: false } },
              operations: {
                listPets: { valibot: { strict: { query: true } } },
              },
            },
          },
        },
        workspace,
      );

      const { override } = normalized.output;
      expect(override.valibot.exactOptional).toBe(true);
      expect(override.valibot.generate.body).toBe(false);
      expect(override.valibot.generate.response).toBe(true);
      expect(override.operations.listPets?.valibot).toEqual({
        strict: { query: true },
      });

      const merged = mergeDeep(override, override.operations.listPets ?? {});
      expect(merged.valibot).toEqual({
        strict: { ...override.valibot.strict, query: true },
        generate: override.valibot.generate,
        exactOptional: true,
        generateReusableSchemas: false,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  describe('schemas.type valibot', () => {
    const normalizeSchemas = async (
      schemas: Record<string, unknown>,
      output: Record<string, unknown> = {},
    ) => {
      const workspace = await createTempWorkspace();
      try {
        return await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              client: 'fetch',
              target: './generated.ts',
              schemas: { path: './model', type: 'valibot', ...schemas },
              ...output,
            },
          },
          workspace,
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    };

    it('writes one module with the .valibot.ts extension', async () => {
      const { output } = await normalizeSchemas({});
      expect(output.schemaFileExtension).toBe('.valibot.ts');
      expect((output.schemas as NormalizedSchemaOptions).mode).toBe('single');
    });

    it('accepts a path that names the module', async () => {
      const { output } = await normalizeSchemas({ path: './model.valibot.ts' });
      expect((output.schemas as NormalizedSchemaOptions).mode).toBe('single');
    });

    it.each([
      ['mode split', { mode: 'split' }, /schemas\.mode "split"/],
      ['routes', { routes: { default: 'models' } }, /schemas\.routes/],
      ['splitByTags', { splitByTags: true }, /schemas\.splitByTags/],
    ])('rejects %s', async (_, schemas, message) => {
      await expect(normalizeSchemas(schemas)).rejects.toThrow(message);
    });

    it.each(['zod', 'effect', 'valibot', 'hono', 'mcp'])(
      'rejects client %s',
      async (client) => {
        await expect(normalizeSchemas({}, { client })).rejects.toThrow(
          `cannot be used with client "${client}"`,
        );
      },
    );

    it.each([
      ['operationSchemas', { operationSchemas: './operations' }],
      ['factoryMethods', { factoryMethods: {} }],
    ])('rejects %s', async (_, output) => {
      await expect(normalizeSchemas({}, output)).rejects.toThrow(
        'schemas.type "valibot" cannot be combined with operationSchemas or factoryMethods',
      );
    });

    it('rejects mock generators', async () => {
      await expect(normalizeSchemas({}, { mock: true })).rejects.toThrow(
        'schemas.type "valibot" cannot be combined with mock generators',
      );
    });
  });

  describe('valibot generateReusableSchemas', () => {
    const normalizeValibot = async (
      output: Record<string, unknown>,
      generateReusableSchemas?: boolean,
    ) => {
      const workspace = await createTempWorkspace();
      try {
        return await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              client: 'valibot',
              override: { valibot: { generateReusableSchemas } },
              ...output,
            },
          },
          workspace,
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    };

    it('is off by default', async () => {
      const normalized = await normalizeValibot({ target: './generated.ts' });
      expect(normalized.output.override.valibot.generateReusableSchemas).toBe(
        false,
      );
    });

    it('can be turned on', async () => {
      const normalized = await normalizeValibot(
        { target: './generated.ts' },
        true,
      );
      expect(normalized.output.override.valibot.generateReusableSchemas).toBe(
        true,
      );
    });

    it('is dropped from operation and tag overrides', async () => {
      const normalized = await normalizeValibot({
        target: './generated.ts',
        override: {
          operations: {
            listPets: {
              valibot: { generateReusableSchemas: true, exactOptional: true },
            },
          },
          tags: { pets: { valibot: { generateReusableSchemas: true } } },
        },
      });
      const { operations, tags } = normalized.output.override;
      expect(operations.listPets?.valibot).toEqual({ exactOptional: true });
      expect(tags.pets?.valibot).toEqual({});
    });

    it('warns for a defined operation override but not for undefined', async () => {
      logWarningSpy.mockClear();
      await normalizeValibot({
        target: './generated.ts',
        override: {
          operations: {
            listPets: { valibot: { generateReusableSchemas: undefined } },
          },
        },
      });
      expect(logWarningSpy).not.toHaveBeenCalled();

      await normalizeValibot({
        target: './generated.ts',
        override: {
          operations: {
            listPets: { valibot: { generateReusableSchemas: false } },
          },
        },
      });
      expect(logWarningSpy).toHaveBeenCalledTimes(1);
    });

    it('is rejected together with output.schemas', async () => {
      await expect(
        normalizeValibot(
          { target: './generated.ts', schemas: './model' },
          true,
        ),
      ).rejects.toThrow(/cannot be combined with `output.schemas`/);
    });

    it('is rejected for a custom client function', async () => {
      const client: OutputClientFunc = (clients) => clients.valibot;
      await expect(
        normalizeValibot({ target: './generated.ts', client }, true),
      ).rejects.toThrow(/requires `client: 'valibot'`/);
    });

    it('allows output.schemas when it is off', async () => {
      await expect(
        normalizeValibot(
          { target: './generated.ts', schemas: './model' },
          false,
        ),
      ).resolves.toBeDefined();
    });
  });

  describe('effect generateReusableSchemas', () => {
    const normalizeEffect = async (
      output: Record<string, unknown>,
      generateReusableSchemas?: boolean,
    ) => {
      const workspace = await createTempWorkspace();
      try {
        return await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              client: 'effect',
              override: { effect: { generateReusableSchemas } },
              ...output,
            },
          },
          workspace,
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    };

    it('is off by default', async () => {
      const normalized = await normalizeEffect({ target: './generated.ts' });
      expect(normalized.output.override.effect.generateReusableSchemas).toBe(
        false,
      );
    });

    it('can be turned on', async () => {
      const normalized = await normalizeEffect(
        { target: './generated.ts' },
        true,
      );
      expect(normalized.output.override.effect.generateReusableSchemas).toBe(
        true,
      );
    });

    it('is dropped from operation and tag overrides', async () => {
      const normalized = await normalizeEffect({
        target: './generated.ts',
        override: {
          operations: {
            listPets: {
              effect: { generateReusableSchemas: true, exactOptional: true },
            },
          },
          tags: { pets: { effect: { generateReusableSchemas: true } } },
        },
      });
      const { operations, tags } = normalized.output.override;
      expect(operations.listPets?.effect?.exactOptional).toBe(true);
      expect(operations.listPets?.effect?.generateReusableSchemas).toBe(false);
      expect(tags.pets?.effect?.generateReusableSchemas).toBe(false);
    });

    it('warns for a defined operation override but not for undefined', async () => {
      logWarningSpy.mockClear();
      await normalizeEffect({
        target: './generated.ts',
        override: {
          operations: {
            listPets: { effect: { generateReusableSchemas: undefined } },
          },
        },
      });
      expect(logWarningSpy).not.toHaveBeenCalled();

      await normalizeEffect({
        target: './generated.ts',
        override: {
          operations: {
            listPets: { effect: { generateReusableSchemas: false } },
          },
        },
      });
      expect(logWarningSpy).toHaveBeenCalledTimes(1);
    });

    it('is rejected together with output.schemas', async () => {
      await expect(
        normalizeEffect({ target: './generated.ts', schemas: './model' }, true),
      ).rejects.toThrow(/cannot be combined with `output.schemas`/);
    });

    it('is rejected for a custom client function', async () => {
      const client: OutputClientFunc = (clients) => clients.effect;
      await expect(
        normalizeEffect({ target: './generated.ts', client }, true),
      ).rejects.toThrow(/requires `client: 'effect'`/);
    });

    it('allows output.schemas when it is off', async () => {
      await expect(
        normalizeEffect(
          { target: './generated.ts', schemas: './model' },
          false,
        ),
      ).resolves.toBeDefined();
    });
  });

  it('resolves hono compositeRoute relative to the workspace', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              hono: {
                compositeRoute: './routes.ts',
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.hono.compositeRoute).toBe(
        path.join(workspace, 'routes.ts'),
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('defaults hono handlerGenerationStrategy to "smart"', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: { target: './generated.ts' },
        },
        workspace,
      );

      expect(normalized.output.override.hono.handlerGenerationStrategy).toBe(
        'smart',
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('preserves an explicit hono handlerGenerationStrategy', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: { hono: { handlerGenerationStrategy: 'skip' } },
          },
        },
        workspace,
      );

      expect(normalized.output.override.hono.handlerGenerationStrategy).toBe(
        'skip',
      );
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('keeps client boolean defaults when the user passes them as undefined', async () => {
    const workspace = await createTempWorkspace();

    try {
      const normalized = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0.0' },
              paths: {},
            },
          },
          output: {
            target: './generated.ts',
            override: {
              axios: {
                includeHttpResponseReturnType: undefined,
              },
              fetch: {
                serializeResponseHeaders: undefined,
                includeHttpResponseReturnType: undefined,
                forceSuccessResponse: undefined,
              },
            },
          },
        },
        workspace,
      );

      expect(normalized.output.override.fetch).toMatchObject({
        serializeResponseHeaders: false,
        includeHttpResponseReturnType: true,
        forceSuccessResponse: false,
      });
      expect(
        normalized.output.override.axios.includeHttpResponseReturnType,
      ).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  describe('override.fetch shared runtime options', () => {
    const inlineSpec = {
      openapi: '3.1.0',
      info: { title: 'Test', version: '1.0.0' },
      paths: {},
    };

    it('defaults to inline with the runtime and client config next to the target', async () => {
      const workspace = await createTempWorkspace();

      try {
        const normalized = await normalizeOptions(
          {
            input: { target: inlineSpec },
            output: { target: './src/api/endpoints.ts', client: 'fetch' },
          },
          workspace,
        );

        expect(normalized.output.override.fetch).toMatchObject({
          runtimeImplementationStyle: 'inline',
          runtimeOutputPath: path.join(workspace, 'src/api/runtime.ts'),
          clientConfigOutputPath: path.join(
            workspace,
            'src/api/client-config.ts',
          ),
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('resolves explicit paths against the workspace and keeps the style', async () => {
      const workspace = await createTempWorkspace();

      try {
        const normalized = await normalizeOptions(
          {
            input: { target: inlineSpec },
            output: {
              target: './src/api/endpoints.ts',
              client: 'fetch',
              override: {
                fetch: {
                  runtimeImplementationStyle: 'shared',
                  runtimeOutputPath: './src/runtime.ts',
                  clientConfigOutputPath: './src/api/config.ts',
                },
              },
            },
          },
          workspace,
        );

        expect(normalized.output.override.fetch).toMatchObject({
          runtimeImplementationStyle: 'shared',
          runtimeOutputPath: path.join(workspace, 'src/runtime.ts'),
          clientConfigOutputPath: path.join(workspace, 'src/api/config.ts'),
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  });

  describe('optionsParamRequired with fetch httpClient', () => {
    const fetchOptionsRequiredWarningPattern =
      /httpClient: 'fetch'.*optionsParamRequired.*cannot make.*options.*required/s;

    beforeEach(() => {
      logWarningSpy.mockClear();
    });

    afterEach(() => {
      logWarningSpy.mockClear();
    });

    it('warns when optionsParamRequired is true and httpClient is fetch', async () => {
      const workspace = await createTempWorkspace();

      try {
        const validSpecPath = path.join(workspace, 'petstore.yaml');
        await writeFile(
          validSpecPath,
          'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
        );

        await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './generated.ts',
              httpClient: 'fetch',
              optionsParamRequired: true,
            },
          },
          workspace,
        );

        expect(logWarningSpy).toHaveBeenCalledWith(
          expect.stringMatching(fetchOptionsRequiredWarningPattern),
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('warns when optionsParamRequired is true and httpClient defaults to fetch', async () => {
      const workspace = await createTempWorkspace();

      try {
        const validSpecPath = path.join(workspace, 'petstore.yaml');
        await writeFile(
          validSpecPath,
          'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
        );

        await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './generated.ts',
              optionsParamRequired: true,
            },
          },
          workspace,
        );

        expect(logWarningSpy).toHaveBeenCalledWith(
          expect.stringMatching(fetchOptionsRequiredWarningPattern),
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('does not warn when httpClient is axios', async () => {
      const workspace = await createTempWorkspace();

      try {
        const validSpecPath = path.join(workspace, 'petstore.yaml');
        await writeFile(
          validSpecPath,
          'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
        );

        await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './generated.ts',
              httpClient: 'axios',
              optionsParamRequired: true,
            },
          },
          workspace,
        );

        expect(logWarningSpy).not.toHaveBeenCalledWith(
          expect.stringMatching(fetchOptionsRequiredWarningPattern),
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('does not warn when optionsParamRequired is false with httpClient fetch', async () => {
      const workspace = await createTempWorkspace();

      try {
        const validSpecPath = path.join(workspace, 'petstore.yaml');
        await writeFile(
          validSpecPath,
          'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
        );

        await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './generated.ts',
              httpClient: 'fetch',
              optionsParamRequired: false,
            },
          },
          workspace,
        );

        expect(logWarningSpy).not.toHaveBeenCalledWith(
          expect.stringMatching(fetchOptionsRequiredWarningPattern),
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('does not warn when override.requestOptions is false with httpClient fetch', async () => {
      const workspace = await createTempWorkspace();

      try {
        const validSpecPath = path.join(workspace, 'petstore.yaml');
        await writeFile(
          validSpecPath,
          'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
        );

        await normalizeOptions(
          {
            input: { target: validSpecPath },
            output: {
              target: './generated.ts',
              httpClient: 'fetch',
              optionsParamRequired: true,
              override: {
                requestOptions: false,
              },
            },
          },
          workspace,
        );

        expect(logWarningSpy).not.toHaveBeenCalledWith(
          expect.stringMatching(fetchOptionsRequiredWarningPattern),
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  });

  it('useDatesTransform implies useDates', async () => {
    const workspace = await createTempWorkspace();

    try {
      const validSpecPath = path.join(workspace, 'petstore.yaml');
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const options = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: {
            target: 'gen.ts',
            override: { useDatesTransform: true },
          },
        },
        workspace,
      );

      expect(options.output.override.useDatesTransform).toBe(true);
      expect(options.output.override.useDates).toBe(true);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('useDatesTransform defaults to false', async () => {
    const workspace = await createTempWorkspace();

    try {
      const validSpecPath = path.join(workspace, 'petstore.yaml');
      await writeFile(
        validSpecPath,
        'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
      );

      const options = await normalizeOptions(
        {
          input: { target: validSpecPath },
          output: { target: 'gen.ts' },
        },
        workspace,
      );

      expect(options.output.override.useDatesTransform).toBe(false);
      expect(options.output.override.useBrandedTypes).toBe(false);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it.each([undefined, false, true])(
    'normalizes useReadonlyArrays=%s',
    async (useReadonlyArrays) => {
      const workspace = await createTempWorkspace();
      try {
        const normalized = await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: { target: 'gen.ts', override: { useReadonlyArrays } },
          },
          workspace,
        );
        expect(normalized.output.override.useReadonlyArrays).toBe(
          useReadonlyArrays ?? false,
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    },
  );

  describe('formatType normalization', () => {
    it('returns undefined formatType when not configured', async () => {
      const workspace = await createTempWorkspace();
      try {
        const normalized = await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: { target: './generated.ts' },
          },
          workspace,
        );
        expect(normalized.output.override.formatType).toBeUndefined();
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('throws when formatType entry has no type', async () => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                override: {
                  formatType: {
                    date: { type: '' },
                  },
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow('override.formatType.date.type is required');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('throws when both zod.codec and zod.transform are set', async () => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0.0' },
                  paths: {},
                },
              },
              output: {
                target: './generated.ts',
                override: {
                  formatType: {
                    'date-time': {
                      type: 'Dayjs',
                      zod: { codec: 'isoCodec', transform: 'dayjs' },
                    },
                  },
                },
              },
            },
            workspace,
          ),
        ).rejects.toThrow(
          'override.formatType.date-time.zod: codec and transform are mutually exclusive',
        );
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });

    it('normalizes formatType with imports', async () => {
      const workspace = await createTempWorkspace();
      try {
        const normalized = await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0.0' },
                paths: {},
              },
            },
            output: {
              target: './generated.ts',
              override: {
                formatType: {
                  'date-time': {
                    type: 'Dayjs',
                    import: { name: 'Dayjs', importPath: 'dayjs' },
                    mock: 'dayjs(faker.date.past())',
                    mockImport: {
                      name: 'dayjs',
                      importPath: 'dayjs',
                      default: true,
                    },
                  },
                },
              },
            },
          },
          workspace,
        );

        const dt = normalized.output.override.formatType?.['date-time'];
        expect(dt?.type).toBe('Dayjs');
        expect(dt?.import).toEqual({ name: 'Dayjs', importPath: 'dayjs' });
        expect(dt?.mock).toBe('dayjs(faker.date.past())');
        expect(dt?.mockImport).toEqual({
          name: 'dayjs',
          importPath: 'dayjs',
          default: true,
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  });
});

describe('single-file schema options', () => {
  // #4235: TypeScript types can be written to one module too, at a directory
  // (`index.ts`) or at a named file.
  it.each(['./model', './model/api.schemas.ts'])(
    'accepts TypeScript single-file schemas at %s',
    async (schemasPath) => {
      const workspace = await createTempWorkspace();
      try {
        const options = await normalizeOptions(
          {
            input: {
              target: {
                openapi: '3.1.0',
                info: { title: 'Test', version: '1.0' },
                paths: {},
              },
            },
            output: {
              target: './client.ts',
              mode: 'split',
              schemas: { path: schemasPath, mode: 'single' },
            },
          },
          workspace,
        );

        expect(options.output.schemas).toMatchObject({
          mode: 'single',
          type: 'typescript',
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    },
  );

  it.each([
    {
      schemas: {
        path: './model',
        mode: 'single' as const,
        type: 'typescript' as const,
        splitByTags: true,
      },
      error: 'cannot be combined',
    },
    {
      schemas: {
        path: './model',
        mode: 'single' as const,
        type: 'zod' as const,
        splitByTags: true,
      },
      error: 'cannot be combined',
    },
    {
      schemas: {
        path: './model',
        mode: 'single' as const,
        type: 'zod' as const,
        routes: { default: 'models' },
      },
      error: 'cannot be combined',
    },
  ])(
    'rejects incompatible schema layout $schemas',
    async ({ schemas, error }) => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0' },
                  paths: {},
                },
              },
              output: { target: './client.ts', schemas },
            },
            workspace,
          ),
        ).rejects.toThrow(error);
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    },
  );
});

describe('single-file schema output combinations', () => {
  it.each([
    { operationSchemas: './operations', type: 'zod' as const },
    { mock: true, type: 'zod' as const },
    {
      factoryMethods: { outputDirectory: './factories' },
      type: 'zod' as const,
    },
    { operationSchemas: './operations', type: 'typescript' as const },
    {
      factoryMethods: { outputDirectory: './factories' },
      type: 'typescript' as const,
    },
  ])(
    'rejects unsupported output $0 before writing files',
    async ({ type, ...output }) => {
      const workspace = await createTempWorkspace();
      try {
        await expect(
          normalizeOptions(
            {
              input: {
                target: {
                  openapi: '3.1.0',
                  info: { title: 'Test', version: '1.0' },
                  paths: {},
                },
              },
              output: {
                target: './client.ts',
                schemas: { path: './model', type, mode: 'single' },
                ...output,
              },
            },
            workspace,
          ),
        ).rejects.toThrow('schemas.mode "single" cannot be combined');
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    },
  );

  // #4235
  it('accepts mock generators with TypeScript single-file schemas', async () => {
    const workspace = await createTempWorkspace();
    try {
      const options = await normalizeOptions(
        {
          input: {
            target: {
              openapi: '3.1.0',
              info: { title: 'Test', version: '1.0' },
              paths: {},
            },
          },
          output: {
            target: './client.ts',
            schemas: { path: './model', mode: 'single' },
            mock: { generators: [{ type: 'msw' }] },
          },
        },
        workspace,
      );
      expect(options.output.mock.generators).toHaveLength(1);
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  describe('output-level standardSchema flag', () => {
    it('enables validation for fetch, query and angular', async () => {
      const workspace = await createTempWorkspace();
      try {
        const specPath = path.join(workspace, 'petstore.yaml');
        await writeFile(
          specPath,
          'openapi: 3.1.0\ninfo:\n  title: Test\n  version: 1.0.0\npaths: {}\n',
        );
        const flag = { runtimeValidation: { standardSchema: true } };
        const normalized = await normalizeOptions(
          {
            input: { target: specPath },
            output: {
              target: './generated.ts',
              override: { fetch: flag, query: flag, angular: flag },
            },
          },
          workspace,
        );
        const { fetch, query, angular } = normalized.output.override;

        expect(fetch.runtimeValidation).toMatchObject({
          enabled: true,
          standardSchema: true,
        });
        expect(query.runtimeValidation).toMatchObject({
          enabled: true,
          standardSchema: true,
        });
        expect(angular.runtimeValidation).toMatchObject({
          enabled: true,
          standardSchema: true,
        });
      } finally {
        await rm(workspace, { recursive: true, force: true });
      }
    });
  });
});
