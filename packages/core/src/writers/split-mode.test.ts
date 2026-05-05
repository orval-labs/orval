import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import { OutputMode } from '../types';
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
