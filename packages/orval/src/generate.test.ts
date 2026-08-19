import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const watcherMock = vi.hoisted(() => {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const watcher = {
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
      return watcher;
    }),
  };

  return {
    handlers,
    watch: vi.fn(() => watcher),
    watcher,
  };
});

vi.mock('@orval/core', () => ({
  getWarningCount: vi.fn().mockReturnValue(0),
  isBoolean: (value: unknown) => typeof value === 'boolean',
  isString: (value: unknown) => typeof value === 'string',
  log: vi.fn(),
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

vi.mock('chokidar', () => ({
  watch: watcherMock.watch,
}));

import { getWarningCount, logError, setVerbose } from '@orval/core';

import { generate } from './generate';
import { generateSpec } from './generate-spec';

beforeEach(() => {
  watcherMock.handlers.clear();
});

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

describe('generate - throwOnError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs and resolves generation errors by default', async () => {
    const error = new Error('generation failed');
    vi.mocked(generateSpec).mockRejectedValueOnce(error);

    await expect(
      generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace'),
    ).resolves.toBeUndefined();

    expect(logError).toHaveBeenCalledWith(error);
  });

  it('throws generation errors when throwOnError is enabled', async () => {
    const error = new Error('generation failed');
    vi.mocked(generateSpec).mockRejectedValueOnce(error);

    await expect(
      generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
        throwOnError: true,
      }),
    ).rejects.toThrow(error);

    expect(logError).not.toHaveBeenCalled();
  });

  it('logs watch event generation errors when throwOnError is enabled', async () => {
    const error = new Error('watch generation failed');
    await generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
      throwOnError: true,
      watch: true,
    });

    const readyHandler = watcherMock.handlers.get('ready');
    expect(readyHandler).toBeDefined();
    readyHandler?.();

    vi.mocked(generateSpec).mockRejectedValueOnce(error);

    const changeHandler = watcherMock.handlers.get('all');
    expect(changeHandler).toBeDefined();
    changeHandler?.('change', 'spec.yaml');

    await Promise.resolve();
    expect(logError).toHaveBeenCalledWith(error);
  });
});
