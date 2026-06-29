import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { logWarningSpy } = vi.hoisted(() => ({
  logWarningSpy: vi.fn(),
}));

vi.mock('@orval/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orval/core')>();
  return {
    ...actual,
    logWarning: logWarningSpy,
  };
});

import { normalizeOptions } from './options';

const createTempWorkspace = async () => {
  return mkdtemp(path.join(os.tmpdir(), 'orval-options-'));
};

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

  it('defaults angular runtimeValidation to false', async () => {
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

      expect(normalized.output.override.angular.runtimeValidation).toBe(false);
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
          '`mock.generators[faker].schemasImportPath` requires `schemas.importPath` to also be set',
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
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
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
});
