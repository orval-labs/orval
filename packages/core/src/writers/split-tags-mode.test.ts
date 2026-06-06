import os from 'node:os';
import path from 'node:path';

import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createSplitModeOutput,
  createSplitModeProps,
} from '../test-utils/split-modes';
import { OutputMode } from '../types';
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
