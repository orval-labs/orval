import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { normalizeOptions } from './options';

const createTempWorkspace = async () => {
  return mkdtemp(path.join(os.tmpdir(), 'orval-options-'));
};

describe('normalizeOptions', () => {
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
});
