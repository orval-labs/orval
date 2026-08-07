import { SupportedFormatter } from '@orval/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { MockExecaError } = vi.hoisted(() => ({
  MockExecaError: class MockExecaError extends Error {
    code?: string;
    constructor(message: string) {
      super(message);
      this.name = 'ExecaError';
    }
  },
}));

vi.mock('execa', () => ({
  execa: vi.fn(),
  ExecaError: MockExecaError,
}));

vi.mock('./formatters/prettier', () => ({
  formatWithPrettier: vi.fn(),
}));

vi.mock('@orval/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orval/core')>();
  return {
    ...actual,
    createSuccessMessage: vi.fn(),
    log: vi.fn(),
    logWarning: vi.fn(),
  };
});

import { execa } from 'execa';

import {
  getDocsOutputName,
  getDocsTypedocOptions,
  runFormatter,
} from './write-specs';

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
    const { logWarning } = await import('@orval/core');
    const error = new MockExecaError('spawn oxfmt ENOENT');
    error.code = 'ENOENT';
    mockedExeca.mockRejectedValueOnce(error);

    await runFormatter(SupportedFormatter.OXFMT, paths, 'petstore');

    expect(logWarning).toHaveBeenCalledWith(
      expect.stringContaining('oxfmt not found'),
    );
  });
});

describe('getDocsTypedocOptions', () => {
  const entryPoints = ['/tmp/petstore.ts'];

  it('adds the markdown plugin and keeps the user plugins', () => {
    const options = getDocsTypedocOptions(entryPoints, {
      plugin: ['typedoc-plugin-coverage'],
    });

    expect(options.plugin).toEqual([
      'typedoc-plugin-markdown',
      'typedoc-plugin-coverage',
    ]);
    expect(options.entryPoints).toEqual(entryPoints);
  });

  it('does not add the markdown plugin two times', () => {
    const options = getDocsTypedocOptions(entryPoints, {
      plugin: ['typedoc-plugin-markdown'],
    });

    expect(options.plugin).toEqual(['typedoc-plugin-markdown']);
  });

  it('does not set a theme, thus the user config stays authoritative', () => {
    expect(getDocsTypedocOptions(entryPoints, {})).not.toHaveProperty('theme');
    expect(getDocsTypedocOptions(entryPoints, { theme: 'default' }).theme).toBe(
      'default',
    );
  });

  it('lets the user config override skipErrorChecking', () => {
    expect(getDocsTypedocOptions(entryPoints, {}).skipErrorChecking).toBe(true);
    expect(
      getDocsTypedocOptions(entryPoints, { skipErrorChecking: false })
        .skipErrorChecking,
    ).toBe(false);
  });
});

describe('getDocsOutputName', () => {
  it('uses the markdown output for the markdown theme', () => {
    expect(getDocsOutputName('markdown')).toBe('markdown');
  });

  it('uses the html output for all other themes', () => {
    expect(getDocsOutputName('default')).toBe('html');
    expect(getDocsOutputName('custom-theme')).toBe('html');
    expect(getDocsOutputName(undefined)).toBe('html');
  });
});
