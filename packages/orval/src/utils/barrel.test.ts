import fs from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  readReExportSpecifiers,
  reconcileWorkspaceBarrel,
  reExportSpecifierExists,
} from './barrel';

describe('reExportSpecifierExists', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'orval-barrel-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function write(relativePath: string): Promise<void> {
    const absolute = path.join(dir, relativePath);
    await fs.promises.mkdir(path.dirname(absolute), { recursive: true });
    await fs.promises.writeFile(absolute, '');
  }

  async function probe(specifier: string): Promise<boolean> {
    const indexFile = path.join(dir, 'index.ts');
    return reExportSpecifierExists(indexFile, specifier, '.ts', '.js');
  }

  it('resolves a direct file', async () => {
    await write('foo.ts');
    await expect(probe('./foo')).resolves.toBe(true);
  });

  it('resolves an index file inside a directory', async () => {
    await write('foo/index.ts');
    await expect(probe('./foo')).resolves.toBe(true);
  });

  it('resolves an ESM import extension swapped for the file extension', async () => {
    await write('foo.ts');
    await expect(probe('./foo.js')).resolves.toBe(true);
  });

  it('returns false when no candidate exists', async () => {
    await expect(probe('./missing')).resolves.toBe(false);
  });

  it('short-circuits for bare package specifiers without a filesystem probe', async () => {
    await expect(probe('some-external-package')).resolves.toBe(true);
  });
});

describe('reconcileWorkspaceBarrel', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'orval-barrel-'));
    await fs.promises.writeFile(path.join(dir, 'api.ts'), '');
    await fs.promises.writeFile(path.join(dir, 'petstore.openapi.yaml'), '');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const reconcile = () =>
    reconcileWorkspaceBarrel(
      path.join(dir, 'index.ts'),
      ['./api', './petstore.openapi.yaml'],
      '.ts',
      '',
      new Set(),
      new Set(['./petstore.openapi.yaml']),
    );

  it('writes type-only specifiers as `export type *`, once', async () => {
    await reconcile();
    await reconcile();

    await expect(
      fs.promises.readFile(path.join(dir, 'index.ts'), 'utf8'),
    ).resolves.toBe(
      "export * from './api';\nexport type * from './petstore.openapi.yaml';\n",
    );
  });

  it('reads `export type *` lines', () => {
    expect(
      readReExportSpecifiers("export type * from './petstore.openapi.yaml';"),
    ).toEqual(new Set(['./petstore.openapi.yaml']));
  });
});
