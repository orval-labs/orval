import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { reExportSpecifierExists } from './barrel';

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
    await fs.ensureDir(path.dirname(absolute));
    await fs.writeFile(absolute, '');
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
