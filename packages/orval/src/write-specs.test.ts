import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { NormalizedOutputOptions } from '@orval/core';
import { OutputMockType, SupportedFormatter } from '@orval/core';
import fs from 'fs-extra';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  appendOrCreateBarrel,
  runFormatter,
  writeClientGroupBarrel,
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

const createTempWorkspace = async () => {
  return mkdtemp(path.join(os.tmpdir(), 'orval-write-specs-'));
};

describe('appendOrCreateBarrel', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await createTempWorkspace();
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  it('creates a new barrel file with sorted export lines', async () => {
    const indexFile = path.join(workspace, 'index.ts');

    await appendOrCreateBarrel(indexFile, ['./b', './a']);

    expect(await fs.readFile(indexFile, 'utf8')).toBe(
      "export * from './b';\nexport * from './a';\n",
    );
  });

  it('appends only the imports not already declared', async () => {
    const indexFile = path.join(workspace, 'index.ts');
    await writeFile(indexFile, "export * from './a';\n");

    await appendOrCreateBarrel(indexFile, ['./a', './b']);

    expect(await fs.readFile(indexFile, 'utf8')).toBe(
      "export * from './a';\nexport * from './b';\n",
    );
  });
});

describe('writeClientGroupBarrel', () => {
  let workspace: string;

  beforeEach(async () => {
    workspace = await createTempWorkspace();
  });

  afterEach(async () => {
    await rm(workspace, { recursive: true, force: true });
  });

  const createOutput = (
    overrides: Partial<NormalizedOutputOptions> = {},
  ): NormalizedOutputOptions =>
    ({
      fileExtension: '.ts',
      indexFiles: true,
      commonTypesFileName: 'common-types',
      mock: { indexMockFiles: true, generators: [] },
      tsconfig: undefined,
      ...overrides,
    }) as NormalizedOutputOptions;

  it('creates a sorted barrel with service and resource lines', async () => {
    const clientDir = path.join(workspace, 'client');
    const output = createOutput({ artifacts: { clientDir } });

    const petsService = path.join(clientDir, 'pets', 'pets.service.ts');
    const petsResource = path.join(clientDir, 'pets', 'pets.resource.ts');
    const usersService = path.join(clientDir, 'users', 'users.service.ts');

    const indexFile = await writeClientGroupBarrel(output, [
      usersService,
      petsResource,
      petsService,
    ]);

    expect(indexFile).toBe(path.join(clientDir, 'index.ts'));
    expect(await fs.readFile(indexFile!, 'utf8')).toBe(
      "export * from './pets/pets.resource';\n" +
        "export * from './pets/pets.service';\n" +
        "export * from './users/users.service';\n",
    );
  });

  it('excludes mock files, files outside clientDir, and the barrel itself', async () => {
    const clientDir = path.join(workspace, 'client');
    const output = createOutput({
      artifacts: { clientDir },
      mock: {
        indexMockFiles: true,
        generators: [{ type: OutputMockType.MSW }, { type: OutputMockType.FAKER }],
      },
    });

    const petsService = path.join(clientDir, 'pets', 'pets.service.ts');
    const petsMsw = path.join(clientDir, 'pets', 'pets.msw.ts');
    const petsFaker = path.join(clientDir, 'pets', 'pets.faker.ts');
    const petsSchemas = path.join(clientDir, 'pets', 'pets.schemas.ts');
    const outsideFile = path.join(workspace, 'schemas', 'pet.ts');
    const selfIndex = path.join(clientDir, 'index.ts');

    const indexFile = await writeClientGroupBarrel(output, [
      petsService,
      petsMsw,
      petsFaker,
      petsSchemas,
      outsideFile,
      selfIndex,
    ]);

    expect(indexFile).toBe(selfIndex);
    expect(await fs.readFile(indexFile!, 'utf8')).toBe(
      "export * from './pets/pets.service';\n",
    );
  });

  it('appends only missing lines to a pre-existing tagsSplitDeduplication barrel', async () => {
    const clientDir = path.join(workspace, 'client');
    const indexFile = path.join(clientDir, 'index.ts');
    await fs.outputFile(
      indexFile,
      "export type { Shared } from './common-types';\n" +
        "export * from './pets/pets.service';\n",
    );

    const output = createOutput({ artifacts: { clientDir } });

    // Real files on disk (not just string paths) so the directory-boundary
    // check's realpath resolution matches, mirroring the real writeSpecs
    // flow where every path passed in was actually just written.
    const petsService = path.join(clientDir, 'pets', 'pets.service.ts');
    const petsResource = path.join(clientDir, 'pets', 'pets.resource.ts');
    const commonTypes = path.join(clientDir, 'common-types.ts');
    await fs.outputFile(petsService, 'export const PetsService = {};\n');
    await fs.outputFile(petsResource, 'export const petsResource = {};\n');
    await fs.outputFile(commonTypes, 'export interface Shared {}\n');

    const result = await writeClientGroupBarrel(output, [
      petsService,
      petsResource,
      commonTypes,
    ]);

    expect(result).toBe(indexFile);
    expect(await fs.readFile(indexFile, 'utf8')).toBe(
      "export type { Shared } from './common-types';\n" +
        "export * from './pets/pets.service';\n" +
        "export * from './pets/pets.resource';\n",
    );
  });

  it('applies the NodeNext import extension when the tsconfig requires it', async () => {
    const clientDir = path.join(workspace, 'client');
    const output = createOutput({
      artifacts: { clientDir },
      tsconfig: {
        compilerOptions: { moduleResolution: 'nodenext' },
      } as NormalizedOutputOptions['tsconfig'],
    });

    const petsService = path.join(clientDir, 'pets', 'pets.service.ts');

    const indexFile = await writeClientGroupBarrel(output, [petsService]);

    expect(await fs.readFile(indexFile!, 'utf8')).toBe(
      "export * from './pets/pets.service.js';\n",
    );
  });

  it('returns undefined when artifacts is not set', async () => {
    const output = createOutput({ artifacts: undefined });

    const result = await writeClientGroupBarrel(output, [
      path.join(workspace, 'client', 'pets', 'pets.service.ts'),
    ]);

    expect(result).toBeUndefined();
  });

  it('returns undefined when there are no client files under clientDir', async () => {
    const clientDir = path.join(workspace, 'client');
    const output = createOutput({ artifacts: { clientDir } });

    const result = await writeClientGroupBarrel(output, [
      path.join(workspace, 'schemas', 'pet.ts'),
    ]);

    expect(result).toBeUndefined();
  });
});
