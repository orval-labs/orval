import os from 'node:os';
import path from 'node:path';

import {
  type NormalizedOptions,
  SupportedFormatter,
  type WriteSpecBuilder,
} from '@orval/core';
import fs from 'fs-extra';
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

import { runFormatter, writeSpecs } from './write-specs';

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

describe('writeSpecs', () => {
  it('does not rewrite unchanged extra files', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'orval-extra-file-'));
    const filePath = path.join(root, 'context.ts');
    const builder = {
      operations: {},
      verbOptions: {},
      schemas: [],
      title: vi.fn(),
      header: vi.fn(),
      footer: vi.fn(),
      imports: vi.fn(),
      importsMock: vi.fn(),
      extraFiles: [{ path: filePath, content: 'export const context = {};\n' }],
      info: { title: 'Extra files', version: '1.0.0' },
      target: '',
      spec: {},
    } as WriteSpecBuilder;
    const options = {
      output: {
        target: '',
        schemas: false,
        operationSchemas: false,
        workspace: false,
        docs: false,
        formatter: undefined,
        override: { header: false },
        mock: { generators: [] },
      },
      hooks: {},
    } as unknown as NormalizedOptions;

    try {
      await writeSpecs(builder, root, options);
      const past = new Date('2020-01-01T00:00:00.000Z');
      await fs.utimes(filePath, past, past);

      await writeSpecs(builder, root, options);

      expect((await fs.stat(filePath)).mtimeMs).toBe(past.getTime());
    } finally {
      await fs.remove(root);
    }
  });
});
