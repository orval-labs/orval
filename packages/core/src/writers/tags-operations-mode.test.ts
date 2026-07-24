import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSplitModeOperation,
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import { OutputClient, OutputMockType, OutputMode } from '../types';
import { writeTagsOperationsMode } from './tags-operations-mode';

describe('writeTagsOperationsMode', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'orval-tags-operations-mode-'),
    );
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('writes one file per operation nested under its tag directory', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
            implementation: 'export const useListPets = () => {};\n',
          }),
          getPet: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'getPet',
            implementation: 'export const useGetPet = () => {};\n',
          }),
          getHealth: createSplitModeOperation({
            tags: ['health'],
            operationName: 'getHealth',
            implementation: 'export const useGetHealth = () => {};\n',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
        indexFiles: true,
      }),
    };

    const paths = await writeTagsOperationsMode({
      ...props,
      needSchema: false,
    });

    const listPetsPath = path.join(tmpDir, 'pets', 'list-pets.ts');
    const getPetPath = path.join(tmpDir, 'pets', 'get-pet.ts');
    const getHealthPath = path.join(tmpDir, 'health', 'get-health.ts');

    expect(fs.existsSync(listPetsPath)).toBe(true);
    expect(fs.existsSync(getPetPath)).toBe(true);
    expect(fs.existsSync(getHealthPath)).toBe(true);
    expect(paths).toEqual(
      expect.arrayContaining([listPetsPath, getPetPath, getHealthPath]),
    );

    expect(fs.readFileSync(listPetsPath, 'utf8')).toContain('useListPets');
    expect(fs.readFileSync(getPetPath, 'utf8')).toContain('useGetPet');
    expect(fs.readFileSync(getHealthPath, 'utf8')).toContain('useGetHealth');
  });

  it('writes the shared global schemas file when needSchema is true and output.schemas is unset', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);
    const importsCalls: Array<{ imports: readonly { dependency: string }[] }> =
      [];

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
            imports: [{ name: 'Error' }],
            implementation:
              'export const useGetPet = (): Error => ({}) as Error;\n',
          }),
        },
        imports: (args: { imports: readonly { dependency: string }[] }) => {
          importsCalls.push(args);
          return '';
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
        indexFiles: true,
      }),
    };

    const paths = await writeTagsOperationsMode({ ...props, needSchema: true });

    const globalSchemasPath = path.join(tmpDir, 'petstore.schemas.ts');
    expect(fs.existsSync(globalSchemasPath)).toBe(true);
    expect(paths).toContain(globalSchemasPath);
    expect(fs.readFileSync(globalSchemasPath, 'utf8')).toContain(
      'export type Error',
    );

    // Operation files live one directory deeper than the shared schemas
    // file (<dir>/<tag>/<op>.ts vs <dir>/petstore.schemas.ts), so the
    // resolved relative import must climb back up with `../`.
    expect(importsCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: '../petstore.schemas' }),
      ]),
    );
  });

  it('writes a per-tag barrel that re-exports every operation file', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
          }),
          getPet: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'getPet',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
        indexFiles: true,
      }),
    };

    const paths = await writeTagsOperationsMode({
      ...props,
      needSchema: false,
    });

    const indexPath = path.join(tmpDir, 'pets', 'index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);
    expect(paths).toContain(indexPath);

    const content = fs.readFileSync(indexPath, 'utf8');
    expect(content).toMatch(/export \* from '\.\/list-pets'/);
    expect(content).toMatch(/export \* from '\.\/get-pet'/);
  });

  it('omits the per-tag barrel when indexFiles is false', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
        indexFiles: false,
      }),
    };

    await writeTagsOperationsMode({ ...props, needSchema: false });

    expect(fs.existsSync(path.join(tmpDir, 'pets', 'index.ts'))).toBe(false);
  });

  it('writes a shared per-tag helper file once when the header emits shared boilerplate', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        header: () => ({
          implementation: 'type AwaitedInput<T> = PromiseLike<T> | T;\n',
          implementationMock: '',
        }),
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
          }),
          getPet: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'getPet',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
      }),
    };

    const paths = await writeTagsOperationsMode({
      ...props,
      needSchema: false,
    });

    const helperPath = path.join(tmpDir, 'pets', 'pets.helpers.ts');
    expect(fs.existsSync(helperPath)).toBe(true);
    expect(paths).toContain(helperPath);
    expect(fs.readFileSync(helperPath, 'utf8')).toContain('AwaitedInput');

    // Each operation file imports the shared helper rather than redeclaring it.
    const listPetsContent = fs.readFileSync(
      path.join(tmpDir, 'pets', 'list-pets.ts'),
      'utf8',
    );
    expect(listPetsContent).toContain(
      "import type { AwaitedInput } from './pets.helpers';",
    );
    expect(listPetsContent).not.toContain('type AwaitedInput<T>');
  });

  it('imports a runtime helper (e.g. withQueryKey) as a value, not a type-only import', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        header: () => ({
          implementation:
            'const withQueryKey = (query, queryKey) => ({ ...query, queryKey });\n',
          implementationMock: '',
        }),
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
            implementation:
              'export const useListPets = () => withQueryKey({}, []);\n',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
      }),
    };

    await writeTagsOperationsMode({ ...props, needSchema: false });

    const listPetsContent = fs.readFileSync(
      path.join(tmpDir, 'pets', 'list-pets.ts'),
      'utf8',
    );
    expect(listPetsContent).toContain(
      "import { withQueryKey } from './pets.helpers';",
    );
    expect(listPetsContent).not.toContain('import type { withQueryKey }');
  });

  it('omits the helper file when the header emits no shared boilerplate', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
      }),
    };

    const paths = await writeTagsOperationsMode({
      ...props,
      needSchema: false,
    });

    expect(fs.existsSync(path.join(tmpDir, 'pets', 'pets.helpers.ts'))).toBe(
      false,
    );
    expect(paths.some((p) => p.endsWith('.helpers.ts'))).toBe(false);
  });

  it('writes a per-operation mock file when mocks are deinlined', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const mockDir = path.join(tmpDir, 'mocks');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
        mock: {
          indexMockFiles: false,
          path: mockDir,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    const paths = await writeTagsOperationsMode({
      ...props,
      needSchema: false,
    });

    const mockPath = path.join(mockDir, 'pets', 'list-pets.msw.ts');
    expect(fs.existsSync(mockPath)).toBe(true);
    expect(paths).toContain(mockPath);
  });

  it('writes a single mock index aggregating operations across every tag', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const mockDir = path.join(tmpDir, 'mocks');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
          }),
          getHealth: createSplitModeOperation({
            tags: ['health'],
            operationName: 'getHealth',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.REACT_QUERY,
        mock: {
          indexMockFiles: true,
          path: mockDir,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    const paths = await writeTagsOperationsMode({
      ...props,
      needSchema: false,
    });

    // The mock index lives at a tag-independent root path, so it must list
    // operations from BOTH tags — before the write-once fix, only the
    // last-completing tag survived.
    const mockIndexPath = path.join(mockDir, 'index.msw.ts');
    expect(fs.existsSync(mockIndexPath)).toBe(true);
    expect(paths).toContain(mockIndexPath);

    const mockIndex = fs.readFileSync(mockIndexPath, 'utf8');
    expect(mockIndex).toContain('./pets/list-pets.msw');
    expect(mockIndex).toContain('./health/get-health.msw');
  });

  it('throws a clear error for a client that groups operations into a shared structure', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.ANGULAR,
      }),
    };

    await expect(
      writeTagsOperationsMode({ ...props, needSchema: false }),
    ).rejects.toThrow(/not supported with the 'angular' client/);
  });

  it('throws a clear error for axios, which wraps operations in a per-tag factory', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_OPERATIONS,
        client: OutputClient.AXIOS,
      }),
    };

    await expect(
      writeTagsOperationsMode({ ...props, needSchema: false }),
    ).rejects.toThrow(/not supported with the 'axios' client/);
  });
});
