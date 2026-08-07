import fs from 'fs-extra';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { writeGeneratedFile } from './file';

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
    const before = (await fs.stat(filePath)).mtimeMs;

    // Same final content, reached from a different source string: the trailing
    // whitespace is stripped before the comparison.
    await new Promise((resolve) => setTimeout(resolve, 20));
    await writeGeneratedFile(filePath, 'const a = 1;   \n');

    expect((await fs.stat(filePath)).mtimeMs).toBe(before);
    expect(await fs.readFile(filePath, 'utf8')).toBe('const a = 1;\n');
  });

  it('still writes when the content differs', async () => {
    const filePath = path.join(dir, 'out.ts');
    await writeGeneratedFile(filePath, 'const a = 1;\n');
    await writeGeneratedFile(filePath, 'const a = 2;\n');

    expect(await fs.readFile(filePath, 'utf8')).toBe('const a = 2;\n');
  });
});
