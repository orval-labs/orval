import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { withGeneratedFileTransform, writeGeneratedFile } from './file';

describe('writeGeneratedFile', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'orval-write-'));
  });

  afterEach(async () => {
    await fs.remove(dir);
  });

  it('creates the file and strips trailing whitespace', async () => {
    const filePath = path.join(dir, 'nested', 'out.ts');
    await writeGeneratedFile(filePath, 'const a = 1;   \nconst b = 2;\n');

    expect(await fs.readFile(filePath, 'utf8')).toBe(
      'const a = 1;\nconst b = 2;\n',
    );
  });

  it('leaves mtime untouched when the final content is unchanged', async () => {
    const filePath = path.join(dir, 'out.ts');
    await writeGeneratedFile(filePath, 'const a = 1;\n');
    const past = new Date('2020-01-01T00:00:00.000Z');
    await fs.utimes(filePath, past, past);

    // Same final content, reached from a different source string: the trailing
    // whitespace is stripped before the comparison.
    await writeGeneratedFile(filePath, 'const a = 1;   \n');

    expect((await fs.stat(filePath)).mtimeMs).toBe(past.getTime());
    expect(await fs.readFile(filePath, 'utf8')).toBe('const a = 1;\n');
  });

  it('compares transformed content before writing', async () => {
    const filePath = path.join(dir, 'out.ts');
    const format = async (_filePath: string, content: string) =>
      content.replace(';\n', ';   \n').replaceAll("'", '"');

    await withGeneratedFileTransform(format, () =>
      writeGeneratedFile(filePath, "const value = 'test';\n"),
    );
    const past = new Date('2020-01-01T00:00:00.000Z');
    await fs.utimes(filePath, past, past);

    await withGeneratedFileTransform(format, () =>
      writeGeneratedFile(filePath, "const value = 'test';\n"),
    );

    expect(await fs.readFile(filePath, 'utf8')).toBe('const value = "test";\n');
    expect((await fs.stat(filePath)).mtimeMs).toBe(past.getTime());
  });

  it('still writes when the content differs', async () => {
    const filePath = path.join(dir, 'out.ts');
    await writeGeneratedFile(filePath, 'const a = 1;\n');
    await writeGeneratedFile(filePath, 'const a = 2;\n');

    expect(await fs.readFile(filePath, 'utf8')).toBe('const a = 2;\n');
  });
});
