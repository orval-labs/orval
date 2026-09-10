import path from 'node:path';

import { noopReporter, setProjectName, withReporter } from '@orval/core';
import { beforeEach, describe, expect, it, vi } from 'vite-plus/test';

const FILE_PATH = path.resolve('/tmp/pets.service.ts');

const mocks = vi.hoisted(() => ({
  execa: vi.fn(),
  format: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  resolveConfig: vi.fn(),
  stat: vi.fn(),
  writeGeneratedFile: vi.fn(),
}));

vi.mock('@orval/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@orval/core')>();
  return {
    ...actual,
    writeGeneratedFile: mocks.writeGeneratedFile,
  };
});

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mocks.readFile,
    stat: mocks.stat,
    readdir: mocks.readdir,
  },
}));

vi.mock('prettier', () => ({
  format: mocks.format,
  resolveConfig: mocks.resolveConfig,
}));

vi.mock('execa', () => ({
  execa: mocks.execa,
}));

import { formatWithPrettier } from './prettier';

describe('formatWithPrettier', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.stat.mockResolvedValue({
      isDirectory: () => false,
      isFile: () => true,
    });
    mocks.resolveConfig.mockResolvedValue({ semi: true });
    mocks.readFile.mockResolvedValue('const value=1');
    mocks.format.mockResolvedValue('const value = 1;\n');
    mocks.writeGeneratedFile.mockImplementation(async () => {
      await Promise.resolve();
    });
  });

  it('ignores files that disappear before they can be written', async () => {
    const missingFileError = Object.assign(new Error('File vanished'), {
      code: 'ENOENT',
    });
    const warn = vi.fn();

    mocks.writeGeneratedFile.mockRejectedValueOnce(missingFileError);

    await expect(
      withReporter({ ...noopReporter, warn }, () =>
        formatWithPrettier([FILE_PATH]),
      ),
    ).resolves.toBeUndefined();

    expect(warn).not.toHaveBeenCalled();
  });

  it('logs unexpected formatting failures', async () => {
    mocks.format.mockRejectedValueOnce(new Error('Boom'));
    const warn = vi.fn();

    await withReporter({ ...noopReporter, warn }, () => {
      setProjectName('petstore');
      return formatWithPrettier([FILE_PATH]);
    });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining(
          `Failed to format file ${FILE_PATH} - Boom`,
        ),
        projectName: 'petstore',
      }),
    );
  });

  it('formats files when prettier.resolveConfig returns undefined', async () => {
    const prettierConfig = undefined;
    mocks.resolveConfig.mockResolvedValueOnce(prettierConfig);

    await expect(formatWithPrettier([FILE_PATH])).resolves.toBeUndefined();

    expect(mocks.format).toHaveBeenCalledWith('const value=1', {
      filepath: FILE_PATH,
    });
    expect(mocks.writeGeneratedFile).toHaveBeenCalledWith(
      FILE_PATH,
      'const value = 1;\n',
    );
  });

  it('resolves prettier config for each file', async () => {
    const schemaPath = path.resolve('/tmp/pets.schema.ts');

    await formatWithPrettier([FILE_PATH, schemaPath]);

    expect(mocks.resolveConfig).toHaveBeenCalledWith(FILE_PATH);
    expect(mocks.resolveConfig).toHaveBeenCalledWith(schemaPath);
  });
});
