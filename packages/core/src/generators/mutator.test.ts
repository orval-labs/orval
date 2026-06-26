import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { generateMutator } from './mutator';

describe('generateMutator', () => {
  it('inspects ESM-only package mutators from the workspace', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'orval-mutator-'));

    try {
      const output = path.join(workspace, 'generated', 'client.ts');
      const packageDir = path.join(
        workspace,
        'node_modules',
        '@acme',
        'esm-mutator',
      );

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
        'export const customInstance = (config, options) => config;\n',
      );

      const mutator = await generateMutator({
        output,
        name: 'client',
        workspace,
        mutator: {
          path: '@acme/esm-mutator/fetch',
          name: 'customInstance',
          default: false,
        },
      });

      expect(mutator).toMatchObject({
        path: '@acme/esm-mutator/fetch',
        name: 'customInstance',
        hasSecondArg: true,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });

  it('uses resolved package files for inspection and keeps the package import', async () => {
    const workspace = await mkdtemp(path.join(os.tmpdir(), 'orval-mutator-'));

    try {
      const output = path.join(workspace, 'generated', 'client.ts');
      const packageDir = path.join(
        workspace,
        'node_modules',
        '@acme',
        'orval-mutator',
      );
      const resolvedPath = path.join(packageDir, 'fetch.js');

      await mkdir(packageDir, { recursive: true });
      await writeFile(
        resolvedPath,
        'export const customInstance = (config, options) => config;\n',
      );

      const mutator = await generateMutator({
        output,
        name: 'client',
        workspace,
        mutator: {
          path: '@acme/orval-mutator/fetch',
          resolvedPath,
          name: 'customInstance',
          default: false,
        },
      });

      expect(mutator).toMatchObject({
        path: '@acme/orval-mutator/fetch',
        name: 'customInstance',
        hasSecondArg: true,
      });
    } finally {
      await rm(workspace, { recursive: true, force: true });
    }
  });
});
