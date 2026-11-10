import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vite-plus/test';

import { generateMutator } from './mutator';
import { readMutatorSource, withMutatorSourceCache } from './mutator-source';

describe('mutator source cache', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-mutator-source-'));
    file = path.join(dir, 'mutator.ts');
    fs.writeFileSync(file, 'first');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('shares concurrent and sequential reads for normalized paths within a scope', async () => {
    const read = vi.spyOn(fs.promises, 'readFile');
    await withMutatorSourceCache(async () => {
      const sources = await Promise.all([
        ...Array.from({ length: 10 }, () => readMutatorSource(file)),
        readMutatorSource(`${dir}${path.sep}.${path.sep}mutator.ts`),
      ]);
      const again = await readMutatorSource(file);
      expect(sources.every((source) => source.content === 'first')).toBe(true);
      expect(again).toEqual(sources[0]);
    });
    expect(read).toHaveBeenCalledTimes(1);
    await withMutatorSourceCache(() => readMutatorSource(file));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('reads fresh outside a scope and hashes the original bytes', async () => {
    const bytes = Buffer.from([0x61, 0xff, 0x62]);
    fs.writeFileSync(file, bytes);
    expect(await readMutatorSource(file)).toEqual({
      content: bytes.toString('utf8'),
      hash: createHash('sha256').update(bytes).digest('hex'),
    });
    fs.writeFileSync(file, 'other');
    expect((await readMutatorSource(file)).content).toBe('other');
  });

  it('reads once per standalone mutator inspection without retaining the source', async () => {
    fs.writeFileSync(
      file,
      'export const custom = (a: unknown, b: unknown) => a;\n',
    );
    const read = vi.spyOn(fs.promises, 'readFile');
    const syncRead = vi.spyOn(fs, 'readFileSync');
    for (let i = 0; i < 2; i++) {
      const result = await generateMutator({
        output: path.join(dir, 'client.ts'),
        name: 'client',
        workspace: dir,
        mutator: { path: file, name: 'custom', default: false },
      });
      expect(result?.hasSecondArg).toBe(true);
    }
    expect(read.mock.calls.filter(([target]) => target === file)).toHaveLength(
      2,
    );
    expect(
      syncRead.mock.calls.filter(([target]) => target === file),
    ).toHaveLength(0);
  });

  it('evicts a failed read so a repaired file can be read in the same scope', async () => {
    fs.rmSync(file);
    const read = vi.spyOn(fs.promises, 'readFile');
    await withMutatorSourceCache(async () => {
      await expect(readMutatorSource(file)).rejects.toThrow();
      fs.writeFileSync(file, 'repaired');
      expect((await readMutatorSource(file)).content).toBe('repaired');
    });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('isolates concurrent scopes even when one has already cached the path', async () => {
    let release!: () => void;
    let loaded!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const firstLoaded = new Promise<void>((resolve) => {
      loaded = resolve;
    });
    const first = withMutatorSourceCache(async () => {
      const before = await readMutatorSource(file);
      loaded();
      await gate;
      return [before, await readMutatorSource(file)];
    });
    await firstLoaded;
    fs.writeFileSync(file, 'other');
    try {
      const second = await withMutatorSourceCache(() =>
        readMutatorSource(file),
      );
      expect(second.content).toBe('other');
    } finally {
      release();
    }
    const [before, after] = await first;
    expect(before.content).toBe('first');
    expect(after).toEqual(before);
  });
  it.each([false, true])(
    'ends the cache lifetime after the callback settles (rejects: %s)',
    async (rejects) => {
      let release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let child!: Promise<string[]>;
      const read = vi.spyOn(fs.promises, 'readFile');
      const run = withMutatorSourceCache(async () => {
        await readMutatorSource(file);
        child = (async () => {
          await gate;
          const first = await readMutatorSource(file);
          fs.writeFileSync(file, 'last');
          return [first.content, (await readMutatorSource(file)).content];
        })();
        if (rejects) throw new Error('generation failed');
      });

      if (rejects) await expect(run).rejects.toThrow('generation failed');
      else await run;
      fs.writeFileSync(file, 'after');
      release();
      expect(await child).toEqual(['after', 'last']);
      expect(read).toHaveBeenCalledTimes(3);
    },
  );

  it('refreshes mutator type flags and arity in a new scope after an edit', async () => {
    const first = 'export const custom = (a: unknown) => a;\n';
    const second =
      'export type ErrorType<T> = T;\nexport type BodyType<T> = T;\nexport const custom = (a: unknown, b: unknown) => a;\n';
    const padded = first.padEnd(second.length, ' ');
    const timestamp = new Date('2026-01-01T00:00:00Z');
    const inspect = () =>
      generateMutator({
        output: path.join(dir, 'client.ts'),
        name: 'client',
        workspace: dir,
        mutator: { path: file, name: 'custom', default: false },
      });
    fs.writeFileSync(file, padded);
    fs.utimesSync(file, timestamp, timestamp);
    const before = fs.statSync(file);
    expect(await withMutatorSourceCache(inspect)).toMatchObject({
      hasErrorType: false,
      hasSecondArg: false,
    });
    fs.writeFileSync(file, second);
    fs.utimesSync(file, timestamp, timestamp);
    expect(fs.statSync(file)).toMatchObject({
      size: before.size,
      mtimeMs: before.mtimeMs,
    });
    expect(await withMutatorSourceCache(inspect)).toMatchObject({
      hasErrorType: true,
      bodyTypeName: 'BodyType',
      hasSecondArg: true,
    });
  });
});
