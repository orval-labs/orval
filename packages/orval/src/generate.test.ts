import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@orval/core', () => ({
  getWarningCount: vi.fn().mockReturnValue(0),
  isString: (value: unknown) => typeof value === 'string',
  logError: vi.fn(),
  resetWarnings: vi.fn(),
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

import { getWarningCount, setVerbose } from '@orval/core';

import { generate } from './generate';

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

describe('generate - failOnWarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when failOnWarnings is enabled and warnings were emitted', async () => {
    vi.mocked(getWarningCount).mockReturnValueOnce(2);

    await expect(
      generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
        failOnWarnings: true,
      }),
    ).rejects.toThrow(/warning/);
  });

  it('does not throw when failOnWarnings is enabled but no warnings', async () => {
    vi.mocked(getWarningCount).mockReturnValueOnce(0);

    await expect(
      generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
        failOnWarnings: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when failOnWarnings is not set even with warnings', async () => {
    vi.mocked(getWarningCount).mockReturnValueOnce(3);

    await expect(
      generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace'),
    ).resolves.toBeUndefined();
  });
});
