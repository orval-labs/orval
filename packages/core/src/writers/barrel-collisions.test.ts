import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { getAmbiguousBarrelExports } from './barrel-collisions';

describe('getAmbiguousBarrelExports', () => {
  let dir: string;

  const write = (name: string, content: string) =>
    fs.promises.writeFile(path.join(dir, name), content);

  beforeEach(async () => {
    dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'orval-barrel-'));
  });

  afterEach(async () => {
    await fs.promises.rm(dir, { recursive: true, force: true });
  });

  // The shape #4217 was filed for: a TypeScript model output and a reusable
  // Zod schema output writing into one `schemas` directory.
  it('reports a name exported by a model and a zod schema', async () => {
    await write('cat.ts', 'export interface Cat {\n  name: string;\n}\n');
    await write(
      'cat-reusable.zod.ts',
      'export const Cat = zod.object({});\n\nexport type Cat = zod.input<typeof Cat>;\nexport type CatOutput = zod.output<typeof Cat>;\n',
    );
    await write('catType.ts', 'export type CatType = "cat";\n');
    await write(
      'index.ts',
      "export * from './cat';\nexport * from './cat-reusable.zod';\nexport * from './catType';\n",
    );

    expect(
      await getAmbiguousBarrelExports(path.join(dir, 'index.ts')),
    ).toStrictEqual(new Map([['Cat', ['./cat', './cat-reusable.zod']]]));
  });

  it('does not report a value and its companion type in one module', async () => {
    await write(
      'cat.zod.ts',
      'export const Cat = zod.object({});\nexport type Cat = zod.input<typeof Cat>;\n',
    );
    await write('index.ts', "export * from './cat.zod';\n");

    expect(
      (await getAmbiguousBarrelExports(path.join(dir, 'index.ts'))).size,
    ).toBe(0);
  });

  it('resolves specifiers written with a .js import extension', async () => {
    await write('a.ts', 'export type Shared = string;\n');
    await write('b.ts', 'export enum Shared {}\n');
    await write(
      'index.ts',
      "export * from './a.js';\nexport * from './b.js';\n",
    );

    expect(
      await getAmbiguousBarrelExports(path.join(dir, 'index.ts')),
    ).toStrictEqual(new Map([['Shared', ['./a.js', './b.js']]]));
  });

  it('does not report specifiers that resolve to the same file', async () => {
    await write('cat.ts', 'export interface Cat {}\n');
    await write(
      'index.ts',
      "export * from './cat';\nexport * from './cat.js';\n",
    );

    expect(
      (await getAmbiguousBarrelExports(path.join(dir, 'index.ts'))).size,
    ).toBe(0);
  });

  it('skips directory re-exports and missing modules', async () => {
    await fs.promises.mkdir(path.join(dir, 'pets'));
    await write('pets/index.ts', 'export type Pet = string;\n');
    await write('pet.ts', 'export type Pet = string;\n');
    await write(
      'index.ts',
      "export * from './pets';\nexport * from './pet';\nexport * from './gone';\n",
    );

    expect(
      (await getAmbiguousBarrelExports(path.join(dir, 'index.ts'))).size,
    ).toBe(0);
  });
});
