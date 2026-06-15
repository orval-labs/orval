import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, describe, expect, it } from 'vitest';

import { type GeneratorSchema, NamingConvention } from '../types';
import { writeSchemasTagsSplit } from './schemas-tags-split';

const tmpDir = () => fs.mkdtemp(path.join(os.tmpdir(), 'orval-test-'));

let dir = '';

afterEach(async () => {
  if (dir) await fs.remove(dir);
});

const makeSchema = (
  name: string,
  importNames: string[] = [],
): GeneratorSchema => ({
  name,
  model: `export type ${name} = any;`,
  imports: importNames.map((n) => ({ name: n })),
});

const DEFAULT_HEADER = '/** header */';

const baseOptions = {
  target: 'test',
  namingConvention: NamingConvention.CAMEL_CASE,
  fileExtension: '.ts',
  header: DEFAULT_HEADER,
  indexFiles: true,
} as const;

describe('writeSchemasTagsSplit', () => {
  it('writes schemas into per-tag subdirectories', async () => {
    const dir = await tmpDir();
    const schemas = [makeSchema('Pet'), makeSchema('Store')];
    const operations = [
      { imports: [{ name: 'Pet' }], tags: ['pets'] },
      { imports: [{ name: 'Store' }], tags: ['stores'] },
    ];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas,
      ...baseOptions,
      operations,
    });

    expect(await fs.pathExists(path.join(dir, 'pets', 'pet.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'stores', 'store.ts'))).toBe(
      true,
    );
    expect(await fs.pathExists(path.join(dir, 'index.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'pets', 'index.ts'))).toBe(true);
  });

  it('places shared schemas at root', async () => {
    const dir = await tmpDir();
    const schemas = [makeSchema('Pet'), makeSchema('Error')];
    const operations = [
      { imports: [{ name: 'Pet' }, { name: 'Error' }], tags: ['pets'] },
      { imports: [{ name: 'Error' }], tags: ['stores'] },
    ];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas,
      ...baseOptions,
      operations,
    });

    expect(await fs.pathExists(path.join(dir, 'pets', 'pet.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'error.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, '_shared'))).toBe(false);
  });

  it('generates correct cross-tag import paths to root', async () => {
    const dir = await tmpDir();
    const schemas = [makeSchema('Pet', ['Error']), makeSchema('Error')];
    const operations = [
      { imports: [{ name: 'Pet' }, { name: 'Error' }], tags: ['pets'] },
      { imports: [{ name: 'Error' }], tags: ['stores'] },
    ];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas,
      ...baseOptions,
      operations,
    });

    const petContent = await fs.readFile(
      path.join(dir, 'pets', 'pet.ts'),
      'utf8',
    );
    expect(petContent).toContain("from '../error'");
  });

  it('appends import extension for ESM module resolution', async () => {
    const dir = await tmpDir();
    const schemas = [makeSchema('Pet', ['Error']), makeSchema('Error')];
    const operations = [
      { imports: [{ name: 'Pet' }, { name: 'Error' }], tags: ['pets'] },
      { imports: [{ name: 'Error' }], tags: ['stores'] },
    ];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas,
      ...baseOptions,
      tsconfig: { compilerOptions: { moduleResolution: 'NodeNext' } },
      operations,
    });

    const petContent = await fs.readFile(
      path.join(dir, 'pets', 'pet.ts'),
      'utf8',
    );
    expect(petContent).toContain("from '../error.js'");
  });

  it('does not write root index when indexFiles is false', async () => {
    const dir = await tmpDir();
    const schemas = [makeSchema('Pet')];
    const operations = [{ imports: [{ name: 'Pet' }], tags: ['pets'] }];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas,
      ...baseOptions,
      indexFiles: false,
      operations,
    });

    expect(await fs.pathExists(path.join(dir, 'index.ts'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, 'pets', 'index.ts'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, 'pets', 'pet.ts'))).toBe(true);
  });

  it('handles all schemas at root when no operations reference them', async () => {
    const dir = await tmpDir();
    const schemas = [makeSchema('Pet'), makeSchema('Store')];
    const operations: Array<{
      imports: Array<{ name: string }>;
      tags: string[];
    }> = [];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas,
      ...baseOptions,
      operations,
    });

    expect(await fs.pathExists(path.join(dir, 'pet.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'store.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'pets'))).toBe(false);
    expect(await fs.pathExists(path.join(dir, 'stores'))).toBe(false);
  });

  it('handles all schemas in one tag', async () => {
    const dir = await tmpDir();
    const schemas = [makeSchema('Pet'), makeSchema('Store')];
    const operations = [
      { imports: [{ name: 'Pet' }, { name: 'Store' }], tags: ['pets'] },
    ];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas,
      ...baseOptions,
      operations,
    });

    expect(await fs.pathExists(path.join(dir, 'pets', 'pet.ts'))).toBe(true);
    expect(await fs.pathExists(path.join(dir, 'pets', 'store.ts'))).toBe(true);
  });

  it('handles empty schemas array', async () => {
    const dir = await tmpDir();
    const operations = [{ imports: [{ name: 'Pet' }], tags: ['pets'] }];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas: [],
      ...baseOptions,
      operations,
    });

    expect(await fs.pathExists(path.join(dir, 'index.ts'))).toBe(false);
  });

  it('root barrel exports both shared files and tag directories', async () => {
    const dir = await tmpDir();
    const schemas = [
      makeSchema('Pet', ['Error']),
      makeSchema('Error'),
      makeSchema('Pagination'),
      makeSchema('Store'),
    ];
    const operations = [
      {
        imports: [{ name: 'Pet' }, { name: 'Error' }, { name: 'Pagination' }],
        tags: ['pets'],
      },
      {
        imports: [{ name: 'Store' }, { name: 'Error' }, { name: 'Pagination' }],
        tags: ['stores'],
      },
    ];

    await writeSchemasTagsSplit({
      schemaPath: dir,
      schemas,
      ...baseOptions,
      operations,
    });

    const indexContent = await fs.readFile(path.join(dir, 'index.ts'), 'utf8');
    expect(indexContent).toContain("export * from './error'");
    expect(indexContent).toContain("export * from './pagination'");
    expect(indexContent).toContain("export * from './pets'");
    expect(indexContent).toContain("export * from './stores'");
  });
});
