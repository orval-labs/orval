import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import { OutputMockType, OutputMode } from '../types';
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
