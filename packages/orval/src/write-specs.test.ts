import { SupportedFormatter } from '@orval/core';
import type { ExecaError } from 'execa';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: class ExecaError extends Error {
    code?: string;
    constructor(message: string, options?: { code?: string }) {
      super(message);
      this.name = 'ExecaError';
      if (options?.code) this.code = options.code;
    }
  },
}));

vi.mock('./formatters/prettier', () => ({
  formatWithPrettier: vi.fn(),
}));

vi.mock('@orval/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orval/core')>();
  return {
    ...actual,
    log: vi.fn(),
  };
});

import { execa } from 'execa';

import { runFormatter } from './write-specs';

const mockedExeca = vi.mocked(execa);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('runFormatter', () => {
  const paths = ['/tmp/a.ts', '/tmp/b.ts'];

  it('calls oxfmt with paths directly', async () => {
    mockedExeca.mockResolvedValueOnce(undefined as never);
    await runFormatter(SupportedFormatter.OXFMT, paths);
    expect(mockedExeca).toHaveBeenCalledWith('oxfmt', paths);
  });

  it('calls biome check --write with paths', async () => {
    mockedExeca.mockResolvedValueOnce(undefined as never);
    await runFormatter(SupportedFormatter.BIOME, paths);
    expect(mockedExeca).toHaveBeenCalledWith('biome', [
      'check',
      '--write',
      ...paths,
    ]);
  });

  it('delegates to formatWithPrettier for prettier', async () => {
    const { formatWithPrettier } = await import('./formatters/prettier');
    await runFormatter(SupportedFormatter.PRETTIER, paths, 'petstore');
    expect(formatWithPrettier).toHaveBeenCalledWith(paths, 'petstore');
    expect(mockedExeca).not.toHaveBeenCalled();
  });

  it('does nothing when formatter is undefined', async () => {
    await runFormatter(undefined, paths);
    expect(mockedExeca).not.toHaveBeenCalled();
  });

  it('logs a warning when binary is not found (ENOENT)', async () => {
    const { log } = await import('@orval/core');
    const { ExecaError } = await import('execa');

    const error = new ExecaError('spawn oxfmt ENOENT') as ExecaError & {
      code: string;
    };
    error.code = 'ENOENT';
    mockedExeca.mockRejectedValueOnce(error);

    await runFormatter(SupportedFormatter.OXFMT, paths, 'petstore');

    expect(log).toHaveBeenCalledWith(
      expect.stringContaining('oxfmt not found'),
    );
  });
});
