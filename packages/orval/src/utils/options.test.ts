import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

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
