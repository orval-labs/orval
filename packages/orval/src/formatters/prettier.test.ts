import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

const FILE_PATH = path.resolve('/tmp/pets.service.ts');

const mocks = vi.hoisted(() => ({
  execa: vi.fn(),
  format: vi.fn(),
  log: vi.fn(),
  readFile: vi.fn(),
  readdir: vi.fn(),
  resolveConfig: vi.fn(),
  stat: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('@orval/core', () => ({
  log: mocks.log,
}));

vi.mock('node:fs/promises', () => ({
  default: {
    readFile: mocks.readFile,
    writeFile: mocks.writeFile,
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
    mocks.writeFile.mockImplementation(async () => {
      await Promise.resolve();
    });
  });

  it('ignores files that disappear before they can be written', async () => {
    const missingFileError = Object.assign(new Error('File vanished'), {
      code: 'ENOENT',
    });

    mocks.writeFile.mockRejectedValueOnce(missingFileError);

    await expect(
      formatWithPrettier([FILE_PATH], 'petstore'),
    ).resolves.toBeUndefined();

    expect(mocks.log).not.toHaveBeenCalled();
  });

  it('logs unexpected formatting failures', async () => {
    mocks.format.mockRejectedValueOnce(new Error('Boom'));

    await formatWithPrettier([FILE_PATH], 'petstore');

    expect(mocks.log).toHaveBeenCalledTimes(1);
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining(
        `⚠️  petstore - Failed to format file ${FILE_PATH}: Error: Boom`,
      ),
    );
  });

  it('formats files when prettier.resolveConfig returns undefined', async () => {
    const prettierConfig = undefined;
    mocks.resolveConfig.mockResolvedValueOnce(prettierConfig);

    await expect(
      formatWithPrettier([FILE_PATH], 'petstore'),
    ).resolves.toBeUndefined();

    expect(mocks.format).toHaveBeenCalledWith('const value=1', {
      filepath: FILE_PATH,
    });
    expect(mocks.writeFile).toHaveBeenCalledWith(
      FILE_PATH,
      'const value = 1;\n',
    );
  });
});
