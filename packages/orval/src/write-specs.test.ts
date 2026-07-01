import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

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

import { generateSpec } from './generate-spec';
import { normalizeOptions } from './utils/options';
import { getUndeclaredModuleSpecifiers, runFormatter } from './write-specs';

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

describe('getUndeclaredModuleSpecifiers', () => {
  it('does not dedupe by substring', () => {
    const data = "import type { Pet } from './index.schemas';\n";

    expect(
      getUndeclaredModuleSpecifiers(['./index', './index.schemas'], data),
    ).toEqual(['./index']);
  });

  it('dedupes exact import and export module specifiers', () => {
    const data = [
      "import type { Pet } from './index.schemas';",
      "export * from './endpoints';",
    ].join('\n');

    expect(
      getUndeclaredModuleSpecifiers(
        ['./index.schemas', './endpoints', './endpoints.msw'],
        data,
      ),
    ).toEqual(['./endpoints.msw']);
  });
});

describe('writeSpecs workspace index', () => {
  it('creates the workspace index on first run when target is not index.ts', async () => {
    const outputDir = await mkdtemp(path.join(tmpdir(), 'orval-write-specs-'));

    try {
      const options = await normalizeOptions(
        {
          input: {
            target: path.resolve(
              import.meta.dirname,
              '../../../tests/specifications/issue-3675.yaml',
            ),
          },
          output: {
            target: 'endpoints.ts',
            workspace: outputDir,
            mode: 'split',
            client: 'axios',
            indexFiles: true,
          },
        },
        process.cwd(),
      );

      await generateSpec(process.cwd(), options, 'write-specs-test');

      const indexContent = await readFile(
        path.join(outputDir, 'index.ts'),
        'utf8',
      );

      expect(indexContent).toContain("export * from './endpoints'");
      expect(indexContent).toContain("export * from './endpoints.schemas'");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
