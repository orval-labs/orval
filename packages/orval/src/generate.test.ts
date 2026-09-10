import {
  getWarningCount,
  noopReporter,
  type OrvalReporter,
  setLogLevel,
  setProjectName,
  withReporter,
} from '@orval/core';
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

vi.mock('@orval/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orval/core')>();
  return {
    ...actual,
    getWarningCount: vi.fn().mockReturnValue(0),
    resetWarnings: vi.fn(),
    setLogLevel: vi.fn(),
  };
});

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

import { generate } from './generate';
import { generateSpec } from './generate-spec';
import { findConfigFile, loadConfigFile } from './utils/config';
import { normalizeOptions } from './utils/options';

const createSpyReporter = () => {
  const error = vi.fn();
  const reporter: OrvalReporter = { ...noopReporter, error };
  return { error, reporter };
};

const generateQuiet: typeof generate = (...args) =>
  withReporter(noopReporter, () => generate(...args));

beforeEach(() => {
  watcherMock.handlers.clear();
});

describe('generate - log level', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies options.logLevel', async () => {
    await generateQuiet(
      { input: 'spec.yaml', output: 'out.ts' },
      '/workspace',
      {
        logLevel: 'verbose',
      },
    );

    expect(setLogLevel).toHaveBeenCalledWith('verbose');
  });

  it('defaults to info when logLevel is omitted', async () => {
    await generateQuiet(
      { input: 'spec.yaml', output: 'out.ts' },
      '/workspace',
      {
        logLevel: 'verbose',
      },
    );
    await generateQuiet({ input: 'spec.yaml', output: 'out.ts' }, '/workspace');

    expect(setLogLevel).toHaveBeenNthCalledWith(1, 'verbose');
    expect(setLogLevel).toHaveBeenNthCalledWith(2, 'info');
  });
});

describe('generate - failOnWarnings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when failOnWarnings is enabled and warnings were emitted', async () => {
    vi.mocked(getWarningCount).mockReturnValueOnce(2);

    await expect(
      generateQuiet({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
        failOnWarnings: true,
      }),
    ).rejects.toThrow(/warning/);
  });

  it('does not throw when failOnWarnings is enabled but no warnings', async () => {
    vi.mocked(getWarningCount).mockReturnValueOnce(0);

    await expect(
      generateQuiet({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
        failOnWarnings: true,
      }),
    ).resolves.toBeUndefined();
  });

  it('does not throw when failOnWarnings is not set even with warnings', async () => {
    vi.mocked(getWarningCount).mockReturnValueOnce(3);

    await expect(
      generateQuiet({ input: 'spec.yaml', output: 'out.ts' }, '/workspace'),
    ).resolves.toBeUndefined();
  });
});

describe('generate - throwOnError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs and resolves generation errors by default', async () => {
    const failure = new Error('generation failed');
    const { error, reporter } = createSpyReporter();
    vi.mocked(generateSpec).mockRejectedValueOnce(failure);

    await expect(
      withReporter(reporter, () =>
        generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace'),
      ),
    ).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('generation failed'),
        packageName: 'orval',
      }),
    );
  });

  it('logs then throws generation errors when throwOnError is enabled', async () => {
    const failure = new Error('generation failed');
    const { error, reporter } = createSpyReporter();
    vi.mocked(generateSpec).mockRejectedValueOnce(failure);

    await expect(
      withReporter(reporter, () =>
        generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
          throwOnError: true,
        }),
      ),
    ).rejects.toThrow(failure);

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('generation failed'),
        packageName: 'orval',
      }),
    );
  });

  it('logs watch event generation errors when throwOnError is enabled', async () => {
    const failure = new Error('watch generation failed');
    const { error, reporter } = createSpyReporter();
    await withReporter(reporter, () =>
      generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace', {
        throwOnError: true,
        watch: true,
      }),
    );

    const readyHandler = watcherMock.handlers.get('ready');
    expect(readyHandler).toBeDefined();
    readyHandler?.();

    vi.mocked(generateSpec).mockRejectedValueOnce(failure);

    const changeHandler = watcherMock.handlers.get('all');
    expect(changeHandler).toBeDefined();
    changeHandler?.('change', 'spec.yaml');

    await Promise.resolve();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('watch generation failed'),
        packageName: 'orval',
      }),
    );
  });
});

describe('generate - reporter defaults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('installs consoleReporter when no outer reporter is active', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(generateSpec).mockRejectedValueOnce(
      new Error('generation failed'),
    );

    try {
      await generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace');

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('generation failed'),
      );
    } finally {
      consoleLog.mockRestore();
    }
  });

  it('installs consoleReporter after setProjectName without an outer reporter', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(generateSpec).mockRejectedValueOnce(
      new Error('generation failed'),
    );

    try {
      setProjectName('petstore');
      await generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace');

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('generation failed'),
      );
    } finally {
      setProjectName();
      consoleLog.mockRestore();
    }
  });

  it('installs consoleReporter after a projectName-only scope', async () => {
    const consoleLog = vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.mocked(generateSpec).mockRejectedValueOnce(
      new Error('generation failed'),
    );

    try {
      await withReporter({ projectName: 'petstore' }, () =>
        generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace'),
      );

      expect(consoleLog).toHaveBeenCalledWith(
        expect.stringContaining('generation failed'),
      );
    } finally {
      consoleLog.mockRestore();
    }
  });

  it('preserves an outer reporter instead of installing console output', async () => {
    const failure = new Error('generation failed');
    const { error, reporter } = createSpyReporter();
    vi.mocked(generateSpec).mockRejectedValueOnce(failure);

    await withReporter(reporter, () =>
      generate({ input: 'spec.yaml', output: 'out.ts' }, '/workspace'),
    );

    expect(error).toHaveBeenCalledTimes(1);
  });

  it('attaches project metadata to generation errors', async () => {
    const { error, reporter } = createSpyReporter();
    vi.mocked(findConfigFile).mockReturnValue('/workspace/orval.config.ts');
    vi.mocked(loadConfigFile).mockResolvedValue({
      petstore: { input: 'spec.yaml', output: 'out.ts' },
    });
    vi.mocked(generateSpec).mockRejectedValueOnce(
      new Error('generation failed'),
    );

    await withReporter(reporter, () =>
      generate('./orval.config.ts', '/workspace'),
    );

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('petstore'),
        packageName: 'orval',
        projectName: 'petstore',
      }),
    );
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('generation failed'),
      }),
    );
  });

  it('attaches project metadata to normalization warnings', async () => {
    const warn = vi.fn();
    vi.mocked(findConfigFile).mockReturnValue('/workspace/orval.config.ts');
    vi.mocked(loadConfigFile).mockResolvedValue({
      petstore: { input: 'spec.yaml', output: 'out.ts' },
    });
    vi.mocked(normalizeOptions).mockImplementationOnce(async () => {
      const { createLogger } = await import('@orval/core');
      createLogger('orval').warn('config warning');
      return { input: { target: 'spec.yaml' } } as never;
    });

    await withReporter({ ...noopReporter, warn }, () =>
      generate('./orval.config.ts', '/workspace'),
    );

    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('petstore'),
        packageName: 'orval',
        projectName: 'petstore',
      }),
    );
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('config warning'),
      }),
    );
  });
});
