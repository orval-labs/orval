import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createSplitModeOperation,
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import { type GeneratorDependency, OutputMockType, OutputMode } from '../types';
import { writeTagsMode } from './tags-mode';

// Regression: the index mock barrel must emit tags in locale-sorted order
// regardless of I/O completion order inside Promise.all. Without an
// emit-time sort, the barrel order is non-deterministic.

describe('writeTagsMode — index mock barrel has deterministic tag order', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-tags-mode-'));
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
        mode: OutputMode.TAGS,
        mock: {
          indexMockFiles: true,
          path: mockDir,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    await writeTagsMode({ ...props, needSchema: false });

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

// Regression coverage for https://github.com/orval-labs/orval/issues/2309
//
// When `client: 'zod'` is configured (or any other setup where `needSchema`
// is false), writeTagsMode must not include a `*.schemas.ts` path in its
// return value. The path used to leak through, causing `afterAllFilesWrite`
// consumers like `eslint --fix` to crash on a file that was never written.

describe('writeTagsMode — schemas path follows needSchema (#2309)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('omits the *.schemas.ts path when needSchema is false', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, { mode: OutputMode.TAGS }),
    };

    const paths = await writeTagsMode({ ...props, needSchema: false });

    expect(paths.some((p) => p.endsWith('.schemas.ts'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'petstore.schemas.ts'))).toBe(false);
  });

  it('returns the *.schemas.ts path when needSchema is true', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, { mode: OutputMode.TAGS }),
    };

    const paths = await writeTagsMode({ ...props, needSchema: true });

    const schemasPath = path.join(tmpDir, 'petstore.schemas.ts');
    expect(paths).toContain(schemasPath);
    expect(fs.existsSync(schemasPath)).toBe(true);
  });
});

// Regression: when some mock generators have an explicit `path` and others
// fall back to `dirname` (no shared `mock.path`), the generators without a
// path must still compute the correct relative schema import from the mock
// file's actual location (one level deeper in `<dirname>/<kebabTag>/`).

describe('writeTagsMode — mixed generator paths use correct schema imports', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('uses correct schema import when MSW has no path but another generator does', async () => {
    const fakerDir = path.join(tmpDir, 'faker-output');
    const target = path.join(tmpDir, 'petstore.ts');

    const mockImportsCalls: {
      imports: { dependency: string }[];
    }[] = [];
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            mockOutputs: [
              {
                type: OutputMockType.MSW,
                implementation: {
                  function: '',
                  handler: '',
                  handlerName: 'mockHandler',
                },
                imports: [{ name: 'Pet' }],
              },
            ],
          }),
        },
        importsMock: (args: Record<string, unknown>) => {
          mockImportsCalls.push(
            args as unknown as (typeof mockImportsCalls)[number],
          );
          return '';
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS,
        schemas: path.join(tmpDir, 'model'),
        mock: {
          indexMockFiles: false,
          generators: [
            { type: OutputMockType.MSW },
            { type: OutputMockType.FAKER, path: fakerDir },
          ],
        },
      }),
    };

    await writeTagsMode({ ...props, needSchema: false });

    const mswMockPath = path.join(tmpDir, 'pets', 'pets.msw.ts');
    expect(fs.existsSync(mswMockPath)).toBe(true);

    const mswMockCall = mockImportsCalls.find((call) =>
      call.imports.some(
        (imp) =>
          imp.dependency.includes('model') && imp.dependency.startsWith('../'),
      ),
    );
    expect(mswMockCall).toBeDefined();
  });
});

// Regression: when `shouldDeinlineMocks` is true (a generator or shared
// `mock.path` is set) and `indexMockFiles: true`, tags mode must emit a
// dedicated `index.msw.ts` barrel re-exporting the per-tag mock under
// `get<PascalledTag>Mock`. The function name must be built from the same
// transformation the mock file uses (`pascal(kebab(tag))` because
// `generateTargetForTags` stores tags in their kebab form).

describe('writeTagsMode — index mock barrel re-exports get<PascalledTag>Mock', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('re-exports the per-tag mock from the index mock barrel', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const mockDir = path.join(tmpDir, 'mocks');
    const baseProps = createSplitModeProps(target);

    const props = {
      ...baseProps,
      output: createSplitModeOutput(target, {
        mode: OutputMode.TAGS,
        mock: {
          indexMockFiles: true,
          // `path` triggers `shouldDeinlineMocks` so the per-tag mock file
          // (and the re-exporting index barrel) is actually written.
          path: mockDir,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    await writeTagsMode({ ...props, needSchema: false });

    const indexMockPath = path.join(mockDir, 'index.msw.ts');
    expect(fs.existsSync(indexMockPath)).toBe(true);
    const content = fs.readFileSync(indexMockPath, 'utf8');
    // The tag is `pets`; `pascal('pets')` is `Pets`. The barrel must
    // re-export `getPetsMock` (not e.g. `getListPetsMock`) to match the
    // function name the per-tag mock file actually defines.
    expect(content).toMatch(
      /export \{ getPetsMock \} from '\.\/pets\/pets\.msw'/,
    );
  });
});

describe('writeTagsMode — inline mocks upgrade schema imports used at runtime', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('marks an implementation schema import as a runtime import when the mock needs it', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const importsCalls: Array<{ imports: readonly GeneratorDependency[] }> = [];
    const baseProps = createSplitModeProps(target);
    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        operations: {
          listPets: createSplitModeOperation({
            imports: [{ name: 'DisplayColor' }],
            implementation: 'export type Color = DisplayColor;',
            mockOutputs: [
              {
                type: OutputMockType.MSW,
                implementation: {
                  function: '',
                  handler: '',
                  handlerName: 'mockHandler',
                },
                imports: [{ name: 'DisplayColor', values: true }],
              },
            ],
          }),
        },
        imports: (args: { imports: readonly GeneratorDependency[] }) => {
          importsCalls.push(args);
          return '';
        },
      },
      output: createSplitModeOutput(target, { mode: OutputMode.TAGS }),
    };

    await writeTagsMode({ ...props, needSchema: false });

    expect(importsCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          exports: expect.arrayContaining([
            expect.objectContaining({ name: 'DisplayColor', values: true }),
          ]),
        }),
      ]),
    );
  });
});

// Regression coverage for https://github.com/orval-labs/orval/discussions/3596
//
// When `output.schemas` is unset, the schemas import specifier is derived from
// the target filename. Under `module: 'NodeNext' / 'node16'` the specifier must
// carry the runtime extension (`.js`), otherwise the emitted import won't
// resolve. The extension used to be stripped via `extension.replace(/\.ts$/, '')`;
// it now flows through `getImportExtension`.

describe('writeTagsMode — schemas import extension follows tsconfig module', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-tags-mode-'));
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
        mode: OutputMode.TAGS,
        indexFiles: true,
        schemas: undefined,
        tsconfig: { compilerOptions: { module: 'NodeNext' } },
      }),
    };

    await writeTagsMode({ ...props, needSchema: false });

    expect(importsCalls.length).toBeGreaterThan(0);
    expect(importsCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: './petstore.schemas.js' }),
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
        mode: OutputMode.TAGS,
        indexFiles: true,
        schemas: undefined,
      }),
    };

    await writeTagsMode({ ...props, needSchema: false });

    expect(importsCalls.length).toBeGreaterThan(0);
    expect(importsCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: './petstore.schemas' }),
      ]),
    );
  });
});

// Regression: footer `operationNames` drives per-operation return-type exports
// (e.g. Angular `*ClientResult` aliases). Untagged operations are routed into
// the implicit `default` bucket by `addDefaultTagIfEmpty`, so the default
// bucket's footer must receive their names too. The old filter excluded them
// via a `tags.length > 0` guard, so the default-tag file silently dropped its
// footer exports.

describe('writeTagsMode — default-bucket footer includes untagged operations', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-tags-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
    vi.restoreAllMocks();
  });

  it('passes untagged operation names to the default-bucket footer', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const baseProps = createSplitModeProps(target);

    const footerSpy = vi.fn((_args: { operationNames: string[] }) => ({
      implementation: '',
      implementationMock: '',
    }));

    const props = {
      ...baseProps,
      builder: {
        ...baseProps.builder,
        footer: footerSpy,
        operations: {
          listPets: createSplitModeOperation({
            tags: ['pets'],
            operationName: 'listPets',
          }),
          getHealth: createSplitModeOperation({
            tags: [],
            operationName: 'getHealth',
          }),
        },
      } as unknown as typeof baseProps.builder,
      output: createSplitModeOutput(target, { mode: OutputMode.TAGS }),
    };

    await writeTagsMode({ ...props, needSchema: false });

    const operationNamesByBucket = footerSpy.mock.calls.map(
      ([args]) => args.operationNames,
    );

    // The untagged op must reach a footer call (the `default` bucket), not be
    // dropped entirely, and it must not leak into the `pets` bucket.
    const defaultBucket = operationNamesByBucket.find((names) =>
      names.includes('getHealth'),
    );
    expect(defaultBucket).toEqual(['getHealth']);
    expect(operationNamesByBucket).toContainEqual(['listPets']);
  });
});
