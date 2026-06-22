import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

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
import { writeSplitMode } from './split-mode';

// Regression coverage for https://github.com/orval-labs/orval/issues/2309
//
// When `client: 'zod'` is configured (or any other setup where `needSchema`
// is false), writeSplitMode must not include a `*.schemas.ts` path in its
// return value. The path used to leak through, causing `afterAllFilesWrite`
// consumers like `eslint --fix` to crash on a file that was never written.

describe('writeSplitMode — schemas path follows needSchema (#2309)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('omits the *.schemas.ts path when needSchema is false', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, { mode: OutputMode.SPLIT }),
    };

    const paths = await writeSplitMode({ ...props, needSchema: false });

    expect(paths.some((p) => p.endsWith('.schemas.ts'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'petstore.schemas.ts'))).toBe(false);
  });

  it('returns the *.schemas.ts path when needSchema is true', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, { mode: OutputMode.SPLIT }),
    };

    const paths = await writeSplitMode({ ...props, needSchema: true });

    const schemasPath = path.join(tmpDir, 'petstore.schemas.ts');
    expect(paths).toContain(schemasPath);
    expect(fs.existsSync(schemasPath)).toBe(true);
  });
});

// Regression coverage for https://github.com/orval-labs/orval/issues/3318
//
// In `split` mode, `mock: { indexMockFiles: true }` used to be a no-op (only
// `tags-split` honored it). It must now emit a dedicated `index.<ext>.ts`
// barrel re-exporting the single split-mode mock file, and that path must be
// part of the return value so it is formatted / passed to afterAllFilesWrite.

describe('writeSplitMode — indexMockFiles emits a dedicated mock barrel (#3318)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('returns and writes index.<ext>.ts re-exporting the mock file when enabled', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, {
        mode: OutputMode.SPLIT,
        mock: {
          indexMockFiles: true,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    const paths = await writeSplitMode({ ...props, needSchema: false });

    const indexMockPath = path.join(tmpDir, 'index.msw.ts');
    expect(paths).toContain(indexMockPath);
    expect(fs.existsSync(indexMockPath)).toBe(true);
    expect(fs.readFileSync(indexMockPath, 'utf8')).toContain(
      "export * from './petstore.msw'",
    );
  });

  it('does not emit an index mock barrel when indexMockFiles is false', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, {
        mode: OutputMode.SPLIT,
        mock: {
          indexMockFiles: false,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    const paths = await writeSplitMode({ ...props, needSchema: false });

    expect(paths.some((p) => p.endsWith('index.msw.ts'))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, 'index.msw.ts'))).toBe(false);
  });

  it('keeps the output file extension in the re-export for non-TS outputs', async () => {
    // For `.ts` the import is extensionless, but ESM/`.js` outputs need the
    // extension on the specifier or the re-export will not resolve on disk.
    const target = path.join(tmpDir, 'petstore.js');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, {
        mode: OutputMode.SPLIT,
        fileExtension: '.js',
        mock: {
          indexMockFiles: true,
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    const paths = await writeSplitMode({ ...props, needSchema: false });

    const indexMockPath = path.join(tmpDir, 'index.msw.js');
    expect(paths).toContain(indexMockPath);
    expect(fs.readFileSync(indexMockPath, 'utf8')).toContain(
      "export * from './petstore.msw.js'",
    );
  });
});

// Regression coverage for https://github.com/orval-labs/orval/issues/3554
//
// Function-form mock generators (ClientMockBuilder) must be treated as MSW in
// every write mode. The deinlined `rawEntry` lookup and the
// `indexMockFiles: true` path both need to produce a single
// `index.<ext>.ts` barrel even when only a function generator is configured.

describe('writeSplitMode — function generator is treated as MSW (#3554)', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('emits the MSW mock file when only a function generator is configured', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, {
        mode: OutputMode.SPLIT,
        mock: {
          indexMockFiles: false,
          // ClientMockBuilder: the function form of a mock generator.
          // `client.ts` maps this to MSW upstream, so the writer must
          // produce a `petstore.msw.ts` file alongside the implementation.
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

    const paths = await writeSplitMode({ ...props, needSchema: false });

    const mswMockPath = path.join(tmpDir, 'petstore.msw.ts');
    expect(paths).toContain(mswMockPath);
    expect(fs.existsSync(mswMockPath)).toBe(true);
  });

  it('emits a single index.msw.ts barrel for a function generator', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const props = {
      ...createSplitModeProps(target),
      output: createSplitModeOutput(target, {
        mode: OutputMode.SPLIT,
        mock: {
          indexMockFiles: true,
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

    const paths = await writeSplitMode({ ...props, needSchema: false });

    const indexMockPath = path.join(tmpDir, 'index.msw.ts');
    // The barrel path must appear in the returned file list and the file
    // must exist exactly once on disk (no duplicate writes from a
    // non-deduped `writtenMockEntries`).
    expect(paths.filter((p) => p === indexMockPath)).toHaveLength(1);
    expect(fs.existsSync(indexMockPath)).toBe(true);
  });
});

describe('writeSplitMode — separated mocks honor schemas.importPath', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-mode-'));
  });

  afterEach(() => {
    fs.removeSync(tmpDir);
  });

  it('uses the package import path for mock schema imports', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const importsMockCalls: Array<{ imports: readonly GeneratorDependency[] }> =
      [];
    const props = {
      ...createSplitModeProps(target),
      builder: {
        ...createSplitModeProps(target).builder,
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
        importsMock: (args: { imports: readonly GeneratorDependency[] }) => {
          importsMockCalls.push(args);
          return '';
        },
      },
      output: createSplitModeOutput(target, {
        mode: OutputMode.SPLIT,
        indexFiles: true,
        schemas: {
          path: path.join(tmpDir, 'model'),
          type: 'typescript',
          importPath: '@acme/models',
        },
        mock: {
          indexMockFiles: false,
          path: path.join(tmpDir, 'mocks'),
          generators: [{ type: OutputMockType.MSW }],
        },
      }),
    };

    await writeSplitMode({ ...props, needSchema: false });

    expect(importsMockCalls.length).toBeGreaterThan(0);
    expect(importsMockCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: '@acme/models' }),
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

describe('writeSplitMode — schemas import extension follows tsconfig module', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orval-split-mode-'));
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
        mode: OutputMode.SPLIT,
        indexFiles: true,
        schemas: undefined,
        tsconfig: { compilerOptions: { module: 'NodeNext' } },
      }),
    };

    await writeSplitMode({ ...props, needSchema: false });

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
        mode: OutputMode.SPLIT,
        indexFiles: true,
        schemas: undefined,
      }),
    };

    await writeSplitMode({ ...props, needSchema: false });

    expect(importsCalls.length).toBeGreaterThan(0);
    expect(importsCalls[0]?.imports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ dependency: './petstore.schemas' }),
      ]),
    );
  });

  // Regression coverage for https://github.com/orval-labs/orval/issues/3624.
  // A schemas directory whose name contains a dot (e.g. the idiomatic
  // `*.schemas` suffix) is misclassified as a file by `isDirectory`, which made
  // the relative import collapse to `./.` — an unresolvable specifier.
  it('imports from a dotted schemas directory without collapsing to "./." (#3624)', async () => {
    const target = path.join(tmpDir, 'petstore.ts');
    const schemaPath = path.join(tmpDir, 'petstore.schemas');
    const builder = createSplitModeBuilder(target);
    builder.operations = {
      listPets: createSplitModeOperation({
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
      mode: OutputMode.SPLIT,
      schemas: schemaPath,
    });
    const props = {
      ...createSplitModeProps(target),
      builder,
      output,
    };

    await writeSplitMode({ ...props, needSchema: false });

    const content = await fs.readFile(
      path.join(tmpDir, 'petstore.service.ts'),
      'utf8',
    );

    expect(content).toContain("from './petstore.schemas'");
    expect(content).not.toContain("from './.'");
  });
});
