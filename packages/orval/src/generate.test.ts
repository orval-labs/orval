import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@orval/core', () => ({
  isString: (value: unknown) => typeof value === 'string',
  logError: vi.fn(),
  setVerbose: vi.fn(),
}));

vi.mock('./generate-spec', () => ({
  generateSpec: vi.fn(),
}));

vi.mock('./utils/config', () => ({
  findConfigFile: vi.fn(),
  loadConfigFile: vi.fn(),
}));

vi.mock('./utils/options', () => ({
  normalizeOptions: vi.fn().mockResolvedValue({
    input: { target: 'spec.yaml' },
  }),
}));

vi.mock('./utils/watcher', () => ({
  startWatcher: vi.fn(),
}));

import { setVerbose } from '@orval/core';

import { generate } from './generate.ts';

describe('generate - verbose handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enables verbose when options.verbose is true', async () => {
    await generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
      verbose: true,
    });

    expect(setVerbose).toHaveBeenCalledWith(true);
  });

  it('resets verbose when the next call does not pass options.verbose', async () => {
    await generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
      verbose: true,
    });
    await generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace');

    expect(setVerbose).toHaveBeenNthCalledWith(1, true);
    expect(setVerbose).toHaveBeenNthCalledWith(2, false);
  });
});
