import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSplitModeBuilder,
  createSplitModeOperation,
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import {
  OutputClient,
  type GeneratorDependency,
  OutputMockType,
  OutputMode,
} from '../types';
import { writeSplitTagsMode } from './split-tags-mode';

// Regression coverage for https://github.com/orval-labs/orval/issues/2309
//
// When `client: 'zod'` is configured (or any other setup where `needSchema`
// is false), writeSplitTagsMode must not include a `*.schemas.ts` path in its
// return value. The path used to leak through, causing `afterAllFilesWrite`
// consumers like `eslint --fix` to crash on a file that was never written.

describe('writeSplitTagsMode — schemas path follows needSchema (#2309)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('omits the *.schemas.ts path when needSchema is false', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, { mode: OutputMode.TAGS_SPLIT }),
    };

    const paths = await writeSplitTagsMode({ ...props, needSchema: false });

    expect(paths.some((p) => p.endsWith('.schemas.ts'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'petstore.schemas.ts'))).toBe(false);
  });

  it('returns the *.schemas.ts path when needSchema is true', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, { mode: OutputMode.TAGS_SPLIT }),
    };

    const paths = await writeSplitTagsMode({ ...props, needSchema: true });

    const schemasPath = path.join(tmpDir, 'petstore.schemas.ts');
    expect(paths).toContain(schemasPath);
    expect(fs.existsSync(schemasPath)).toBe(true);
  });

  it('imports from the configured schemas directory even before it exists', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const schemaPath = path.join(tmpDir, 'model');
    const builder = createSplitModeBuilder(target);
    builder.operations = {
      listPets: createSplitModeOperation({
        tags: ['Pets'],
        imports: [{ name: 'Pet' }],
        implementation: 'export type ListPetsResponse = Pet;',
      }),
    };
    builder.imports = ({
      imports,
    }: {
      imports: readonly GeneratorDependency[];
    }) =>
      imports
        .map(
          ({ dependency, exports }: GeneratorDependency) =>
            `import type { ${exports.map((entry: { name: string }) => entry.name).join(', ')} } from '${dependency}';`,
        )
        .join('\n');

    const output = createSplitModeOutput(target, {
      client: OutputClient.ANGULAR,
      indexFiles: true,
      mode: OutputMode.TAGS_SPLIT,
      schemas: schemaPath,
    });
    const props = {
      ...createSplitModeProps(target),
      builder,
      output,
    };

    await writeSplitTagsMode({ ...props, needSchema: false });

    const content = await fs.readFile(
      path.join(tmpDir, 'pets', 'pets.service.ts'),
      'utf8',
    );

    expect(content).toContain("from '../model'");
    expect(content).not.toContain("from '../.'");
  });
});

// Regression coverage for https://github.com/orval-labs/orval/issues/3554
//
// `tags-split` mode used to throw when a function-form mock generator
// (ClientMockBuilder) was configured. The throw was originally added because
// function generators could not own a `path`. After #3537 introduced
// `mock.path` and normalized it into the shared config, function generators
// can rely on the shared `path` and the throw is no longer needed. They must
// now be treated as MSW, matching the other modes.

describe('writeSplitTagsMode — function generator is treated as MSW (#3554)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('does not throw and emits the MSW mock file for a function generator', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_SPLIT,
        mock: {
          indexMockFiles: false,
          generators: [
            () => ({
              imports: [],
              implementation: {
                function: '',
                handler: '',
                handlerName: 'mockHandler',
              },
            }),
          ],
        },
      }),
    };

    const paths = await writeSplitTagsMode({ ...props, needSchema: false });

    const mswMockPath = path.join(tmpDir, 'pets', 'pets.msw.ts');
    expect(paths).toContain(mswMockPath);
    expect(paths.some((p) => p.endsWith('index.msw.ts'))).toBe(false);
    expect(fs.existsSync(mswMockPath)).toBe(true);
  });
});

describe('writeSplitTagsMode — index mock barrel has deterministic tag order', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
    vi.restoreAllMocks();
  });

  it('emits barrel exports in locale-sorted tag order even when I/O completes in reverse', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const mockDir = path.join(tmpDir, 'mocks');
    const baseProps = createSplitModeProps(target);

    const { writeGeneratedFile: originalWrite } = await import('./file');
    const writeSpy = vi.spyOn(await import('./file'), 'writeGeneratedFile');
    writeSpy.mockImplementation(async (filePath, content) => {
      if (filePath.includes(path.join(mockDir, 'health'))) {
        await new Promise((r) => setTimeout(r, 10));
      }
      await originalWrite(filePath, content);
    });

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
          getAdmin: createSplitModeOperation({
            tags: ['admin'],
            operationName: 'getAdmin',
          }),
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_SPLIT,
        mock: {
          indexMockFiles: true,
          path: mockDir,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    await writeSplitTagsMode({ ...props, needSchema: false });

    const indexMockPath = path.join(mockDir, 'index.msw.ts');
    expect(fs.existsSync(indexMockPath)).toBe(true);
    const content = fs.readFileSync(indexMockPath, 'utf8');
    const lines = content.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toMatch(/getAdminMock/);
    expect(lines[1]).toMatch(/getHealthMock/);
    expect(lines[2]).toMatch(/getPetsMock/);
  });
});

// Regression coverage for https://github.com/orval-labs/orval/discussions/3596
//
// When `output.schemas` is unset, the schemas import specifier is derived from
// the target filename. Under `module: 'NodeNext' / 'node16'` the specifier must
// carry the runtime extension (`.js`), otherwise the emitted import won't
// resolve. The extension used to be stripped via `extension.replace(/\.ts$/, '')`;
// it now flows through `getImportExtension`. In `tags-split` the tag files live
// in a subdirectory so the relative specifier uses `../`.

describe('writeSplitTagsMode — schemas import extension follows tsconfig module', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('appends .js to the schemas specifier under module: NodeNext', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const importsCalls: Array<{ imports: readonly GeneratorDependency[] }> = [];
    const baseProps = createSplitModeProps(target);
    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            imports: [{ name: 'Pet' }],
            implementation: 'export const listPets = (): Pet | null => null;',
          }),
        },
        imports: (args: { imports: readonly GeneratorDependency[] }) => {
          importsCalls.push(args);
          return '';
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_SPLIT,
        indexFiles: true,
        schemas: undefined,
        tsconfig: { compilerOptions: { module: 'NodeNext' } },
      }),
    };

    await writeSplitTagsMode({ ...props, needSchema: false });

    expect(importsCalls.length).toBeGreaterThan(0);
    expect(importsCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: '../petstore.schemas.js' }),
      ]),
    );
  });

  it('keeps the schemas specifier extensionless without tsconfig', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const importsCalls: Array<{ imports: readonly GeneratorDependency[] }> = [];
    const baseProps = createSplitModeProps(target);
    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            imports: [{ name: 'Pet' }],
            implementation: 'export const listPets = (): Pet | null => null;',
          }),
        },
        imports: (args: { imports: readonly GeneratorDependency[] }) => {
          importsCalls.push(args);
          return '';
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_SPLIT,
        indexFiles: true,
        schemas: undefined,
      }),
    };

    await writeSplitTagsMode({ ...props, needSchema: false });

    expect(importsCalls.length).toBeGreaterThan(0);
    expect(importsCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: '../petstore.schemas' }),
      ]),
    );
  });
});

// The mock index barrel must also honor the tsconfig module setting so
// NodeNext projects get `.js` extensions on the barrel re-exports.
describe('writeSplitTagsMode — mock barrel extension follows tsconfig', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('appends .js to mock barrel re-exports under module: NodeNext', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const mockDir = path.join(tmpDir, 'mocks');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS_SPLIT,
        tsconfig: { compilerOptions: { module: 'NodeNext' } },
        mock: {
          indexMockFiles: true,
          path: mockDir,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    await writeSplitTagsMode({ ...props, needSchema: false });

    const indexMockPath = path.join(mockDir, 'index.msw.ts');
    expect(fs.existsSync(indexMockPath)).toBe(true);
    const content = fs.readFileSync(indexMockPath, 'utf8');
    expect(content).toContain("from './pets/pets.msw.js'");
  });
});
