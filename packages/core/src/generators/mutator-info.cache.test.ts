import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import * as esbuild from 'esbuild';
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { getMutatorInfo } from './mutator-info';

vi.mock('esbuild', async (importOriginal) => {
  const actual = await importOriginal<typeof import('esbuild')>();
  return { ...actual, build: vi.fn(actual.build) };
});

const build = vi.mocked(esbuild.build);

// The cache lives for the whole process, so every test writes its own mutator
// file and no two tests share a key.
describe('getMutatorInfo caching (#4222)', () => {
  let dir: string;

  const writeMutator = (name: string, source: string) => {
    const file = path.join(dir, name);
    fs.writeFileSync(file, source);
    return file;
  };

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-mutator-info-'));
    build.mockClear();
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('bundles a mutator once for repeated and concurrent calls', async () => {
    const file = writeMutator(
      'shared.ts',
      'export const customInstance = (config: unknown, options?: unknown) => config;\n',
    );
    const options = { root: dir, namedExport: 'customInstance' };

    const results = await Promise.all(
      Array.from({ length: 5 }, () => getMutatorInfo(file, options)),
    );
    const again = await getMutatorInfo(file, options);

    expect(build).toHaveBeenCalledTimes(1);
    for (const result of [...results, again]) {
      expect(result).toEqual({ numberOfParams: 2 });
    }
  });

  it('keys on the export, so another export of the same file is bundled', async () => {
    const file = writeMutator(
      'two-exports.ts',
      'export const one = (a: unknown) => a;\nexport const two = (a: unknown, b: unknown) => b;\n',
    );

    expect(
      await getMutatorInfo(file, { root: dir, namedExport: 'one' }),
    ).toEqual({ numberOfParams: 1 });
    expect(
      await getMutatorInfo(file, { root: dir, namedExport: 'two' }),
    ).toEqual({ numberOfParams: 2 });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('re-bundles an edited mutator so watch mode sees the change', async () => {
    const file = writeMutator(
      'edited.ts',
      'export default function (a: unknown) {}\n',
    );

    expect(await getMutatorInfo(file, { root: dir })).toEqual({
      numberOfParams: 1,
    });

    fs.writeFileSync(
      file,
      'export default function (a: unknown, b: unknown, c: unknown) {}\n',
    );

    expect(await getMutatorInfo(file, { root: dir })).toEqual({
      numberOfParams: 3,
    });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('re-bundles an edit that keeps the size and mtime', async () => {
    const file = writeMutator(
      'same-size.ts',
      'export default function (a: unknown, b: unknown) {}\n',
    );
    // A whole-second timestamp survives the round trip through `utimesSync`
    // exactly, so the second call really does see the same `mtimeMs`.
    const time = new Date('2026-01-01T00:00:00Z');
    fs.utimesSync(file, time, time);
    const before = fs.statSync(file);

    expect(await getMutatorInfo(file, { root: dir })).toEqual({
      numberOfParams: 2,
    });

    // Same length as the original: two params become one, padded with spaces.
    fs.writeFileSync(
      file,
      'export default function (a: unknown            ) {}\n',
    );
    fs.utimesSync(file, time, time);
    expect(fs.statSync(file)).toMatchObject({
      size: before.size,
      mtimeMs: before.mtimeMs,
    });

    expect(await getMutatorInfo(file, { root: dir })).toEqual({
      numberOfParams: 1,
    });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('evicts a failed bundle so the next call retries', async () => {
    const file = writeMutator(
      'flaky.ts',
      'export default function (a: unknown) {}\n',
    );
    build.mockRejectedValueOnce(new Error('bundle failed'));

    await expect(getMutatorInfo(file, { root: dir })).rejects.toThrow(
      'bundle failed',
    );
    expect(await getMutatorInfo(file, { root: dir })).toEqual({
      numberOfParams: 1,
    });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it('does not cache a custom external, which can inline other files', async () => {
    const file = writeMutator(
      'custom-external.ts',
      'export default function (a: unknown) {}\n',
    );
    const options = { root: dir, external: ['axios'] };

    await getMutatorInfo(file, options);
    await getMutatorInfo(file, options);

    expect(build).toHaveBeenCalledTimes(2);
  });
});
