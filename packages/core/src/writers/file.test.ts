import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import {
  collectOutdatedGeneratedFiles,
  createGeneratedFileCheck,
  readGeneratedFile,
  withGeneratedFileCheck,
  withGeneratedFileTransform,
  writeGeneratedFile,
} from './file';

describe('writeGeneratedFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'orval-write-'));
  });

  afterEach(async () => {
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  it('creates the file and strips trailing whitespace', async () => {
    const filePath = path.join(dir, 'nested', 'out.ts');
    await writeGeneratedFile(filePath, 'const a = 1;   \nconst b = 2;\n');

    expect(await fs.promises.readFile(filePath, 'utf8')).toBe(
      'const a = 1;\nconst b = 2;\n',
    );
  });

  it('leaves mtime untouched when the final content is unchanged', async () => {
    const filePath = path.join(dir, 'out.ts');
    await writeGeneratedFile(filePath, 'const a = 1;\n');
    const past = new Date('2020-01-01T00:00:00.000Z');
    await fs.promises.utimes(filePath, past, past);

    // Same final content, reached from a different source string: the trailing
    // whitespace is stripped before the comparison.
    await writeGeneratedFile(filePath, 'const a = 1;   \n');

    expect((await fs.promises.stat(filePath)).mtimeMs).toBe(past.getTime());
    expect(await fs.promises.readFile(filePath, 'utf8')).toBe('const a = 1;\n');
  });

  it('compares transformed content before writing', async () => {
    const filePath = path.join(dir, 'out.ts');
    const format = async (_filePath: string, content: string) =>
      content.replace(';\n', ';   \n').replaceAll("'", '"');

    await withGeneratedFileTransform(format, () =>
      writeGeneratedFile(filePath, "const value = 'test';\n"),
    );
    const past = new Date('2020-01-01T00:00:00.000Z');
    await fs.promises.utimes(filePath, past, past);

    await withGeneratedFileTransform(format, () =>
      writeGeneratedFile(filePath, "const value = 'test';\n"),
    );

    expect(await fs.promises.readFile(filePath, 'utf8')).toBe(
      'const value = "test";\n',
    );
    expect((await fs.promises.stat(filePath)).mtimeMs).toBe(past.getTime());
  });

  it('still writes when the content differs', async () => {
    const filePath = path.join(dir, 'out.ts');
    await writeGeneratedFile(filePath, 'const a = 1;\n');
    await writeGeneratedFile(filePath, 'const a = 2;\n');

    expect(await fs.promises.readFile(filePath, 'utf8')).toBe('const a = 2;\n');
  });

  describe('under an outdated check', () => {
    it('collects the files instead of writing them', async () => {
      const check = createGeneratedFileCheck();
      const missing = path.join(dir, 'missing.ts');
      const same = path.join(dir, 'same.ts');
      const changed = path.join(dir, 'changed.ts');
      await fs.promises.writeFile(same, 'const a = 1;\n');
      await fs.promises.writeFile(changed, 'const a = 1;\n');

      await withGeneratedFileCheck(check, async () => {
        await writeGeneratedFile(missing, 'const a = 1;\n');
        await writeGeneratedFile(same, 'const a = 1;   \n');
        await writeGeneratedFile(changed, 'const a = 2;\n');
      });

      expect(fs.existsSync(missing)).toBe(false);
      expect(await fs.promises.readFile(changed, 'utf8')).toBe(
        'const a = 1;\n',
      );
      expect(await collectOutdatedGeneratedFiles(check)).toEqual([
        { path: changed, status: 'outdated' },
        { path: missing, status: 'missing' },
      ]);
    });

    it('compares the transformed content of the last write to a path', async () => {
      const check = createGeneratedFileCheck();
      const filePath = path.join(dir, 'out.ts');
      await fs.promises.writeFile(
        filePath,
        'const value = "test";\nexport {};\n',
      );
      const format = async (_filePath: string, content: string) =>
        content.replaceAll("'", '"');

      await withGeneratedFileCheck(check, () =>
        withGeneratedFileTransform(format, async () => {
          await writeGeneratedFile(filePath, "const value = 'test';\n");
          // A barrel writer reads back what the run produced so far.
          const pending = await readGeneratedFile(filePath);
          await writeGeneratedFile(filePath, `${pending}export {};\n`);
        }),
      );

      expect(await collectOutdatedGeneratedFiles(check)).toEqual([]);
    });

    it('reports a clean candidate the run did not produce as obsolete', async () => {
      const check = createGeneratedFileCheck();
      const kept = path.join(dir, 'kept.ts');
      const stale = path.join(dir, 'stale.ts');
      await fs.promises.writeFile(kept, 'x\n');
      await fs.promises.writeFile(stale, 'x\n');
      check.obsoleteCandidates
        .add(kept)
        .add(stale)
        .add(path.join(dir, 'gone.ts'));

      await withGeneratedFileCheck(check, () =>
        writeGeneratedFile(kept, 'x\n'),
      );

      expect(await collectOutdatedGeneratedFiles(check)).toEqual([
        { path: stale, status: 'obsolete' },
      ]);
    });
  });
});
