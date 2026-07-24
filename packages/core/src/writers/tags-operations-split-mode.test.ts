import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSplitModeOperation,
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import { OutputClient, OutputMode } from '../types';
import { writeTagsOperationsSplitMode } from './tags-operations-split-mode';

describe('writeTagsOperationsSplitMode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'orval-tags-operations-split-mode-'),
    );
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('writes a runtime file and a schemas file per operation', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        schemas: [
          { name: 'Pet', model: '', imports: [], schema: {} },
          { name: 'Unused', model: '', imports: [], schema: {} },
        ],
        operations: {
          getPet: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'getPet',
            imports: [{ name: 'Pet' }],
            implementation:
              'export const useGetPet = (): Pet => ({}) as Pet;\n',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS_SPLIT,
        client: OutputClient.REACT_QUERY,
      }),
    };

    const paths = await writeTagsOperationsSplitMode({
      ...props,
      needSchema: false,
    });

    const implementationPath = path.join(tmpDir, 'pets', 'get-pet.ts');
    const schemasPath = path.join(tmpDir, 'pets', 'get-pet.schemas.ts');

    expect(fs.existsSync(implementationPath)).toBe(true);
    expect(fs.existsSync(schemasPath)).toBe(true);
    expect(paths).toEqual(
      expect.arrayContaining([implementationPath, schemasPath]),
    );

    // Only the referenced schema (`Pet`) lands in the operation's schemas
    // file; unrelated component schemas are not pulled in.
    const schemasContent = fs.readFileSync(schemasPath, 'utf8');
    expect(schemasContent).not.toContain('Unused');
  });

  it('includes transitively-referenced schemas in the operation schemas file', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        schemas: [
          {
            name: 'Pet',
            model: 'export type Pet = Dog | Cat;',
            imports: [{ name: 'Dog' }, { name: 'Cat' }],
            schema: {},
          },
          {
            name: 'Dog',
            model: 'export type Dog = {};',
            imports: [],
            schema: {},
          },
          {
            name: 'Cat',
            model: 'export type Cat = {};',
            imports: [],
            schema: {},
          },
          {
            name: 'Unrelated',
            model: 'export type Unrelated = {};',
            imports: [],
            schema: {},
          },
        ],
        operations: {
          getPet: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'getPet',
            imports: [{ name: 'Pet' }],
            implementation:
              'export const useGetPet = (): Pet => ({}) as Pet;\n',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS_SPLIT,
        client: OutputClient.REACT_QUERY,
      }),
    };

    await writeTagsOperationsSplitMode({ ...props, needSchema: false });

    const schemasContent = fs.readFileSync(
      path.join(tmpDir, 'pets', 'get-pet.schemas.ts'),
      'utf8',
    );
    // Pet's own dependencies (Dog, Cat) must be pulled in transitively so
    // the operation's schemas file is self-contained.
    expect(schemasContent).toContain('Dog');
    expect(schemasContent).toContain('Cat');
    expect(schemasContent).not.toContain('Unrelated');
  });

  it('writes the shared global schemas file when needSchema is true and output.schemas is unset', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        schemas: [
          { name: 'Error', model: 'export type Error = {};', imports: [] },
        ],
        operations: {
          getPet: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'getPet',
            imports: [],
            implementation: 'export const useGetPet = () => {};\n',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS_SPLIT,
        client: OutputClient.REACT_QUERY,
      }),
    };

    const paths = await writeTagsOperationsSplitMode({
      ...props,
      needSchema: true,
    });

    const globalSchemasPath = path.join(tmpDir, 'petstore.schemas.ts');
    expect(fs.existsSync(globalSchemasPath)).toBe(true);
    expect(paths).toContain(globalSchemasPath);
    expect(fs.readFileSync(globalSchemasPath, 'utf8')).toContain(
      'export type Error',
    );
  });

  it('omits the schemas file when the operation references no component schema', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          getHealth: createSplitModeOperation({
            tags: ['health'],
            operationName: 'getHealth',
            imports: [],
            implementation: 'export const useGetHealth = () => true;\n',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS_SPLIT,
        client: OutputClient.REACT_QUERY,
      }),
    };

    const paths = await writeTagsOperationsSplitMode({
      ...props,
      needSchema: false,
    });

    expect(
      fs.existsSync(path.join(tmpDir, 'health', 'getHealth.schemas.ts')),
    ).toBe(false);
    expect(paths.some((p) => p.endsWith('.schemas.ts'))).toBe(false);
  });

  it('writes a per-tag barrel that re-exports each operation runtime file, not its schemas file', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        schemas: [{ name: 'Pet', model: '', imports: [], schema: {} }],
        operations: {
          getPet: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'getPet',
            imports: [{ name: 'Pet' }],
            implementation:
              'export const useGetPet = (): Pet => ({}) as Pet;\n',
          }),
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
            imports: [],
            implementation: 'export const useListPets = () => [];\n',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS_SPLIT,
        client: OutputClient.REACT_QUERY,
        indexFiles: true,
      }),
    };

    await writeTagsOperationsSplitMode({ ...props, needSchema: false });

    const indexPath = path.join(tmpDir, 'pets', 'index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);
    const content = fs.readFileSync(indexPath, 'utf8');
    expect(content).toMatch(/export \* from '\.\/get-pet';/);
    expect(content).toMatch(/export \* from '\.\/list-pets';/);
    // `.schemas` files are never barrel re-exported: two operations that
    // both reference the same component schema (e.g. a shared `Error` type)
    // would otherwise collide as an ambiguous re-export.
    expect(content).not.toMatch(/\.schemas/);
  });

  it('throws a clear error for a client that groups operations into a shared structure', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS_SPLIT,
        client: OutputClient.ANGULAR,
      }),
    };

    await expect(
      writeTagsOperationsSplitMode({ ...props, needSchema: false }),
    ).rejects.toThrow(/not supported with the 'angular' client/);
  });
});
