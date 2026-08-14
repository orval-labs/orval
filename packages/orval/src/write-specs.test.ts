import os from 'node:os';
import path from 'node:path';

import { SupportedFormatter } from '@orval/core';
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

import {
  createMarkdownPluginReader,
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

describe('createMarkdownPluginReader', () => {
  const makeContainer = (initialPlugins?: string[]) => {
    const values: Record<string, unknown> = {};
    if (initialPlugins) {
      values.plugin = initialPlugins;
    }
    return {
      isSet: vi.fn((name: string) => name in values),
      getValue: vi.fn((name: string) => values[name]),
      setValue: vi.fn((name: string, value: unknown) => {
        values[name] = value;
      }),
    };
  };

  it('appends the markdown plugin when it is missing', async () => {
    const reader = createMarkdownPluginReader();
    const container = makeContainer(['typedoc-plugin-coverage']);

    await reader.read(
      container as never,
      undefined as never,
      '',
      () => {},
    );

    expect(container.setValue).toHaveBeenCalledWith('plugin', [
      'typedoc-plugin-coverage',
      'typedoc-plugin-markdown',
    ]);
  });

  it('does not touch the plugin list when the markdown plugin is already present', async () => {
    const reader = createMarkdownPluginReader();
    const container = makeContainer(['typedoc-plugin-markdown']);

    await reader.read(
      container as never,
      undefined as never,
      '',
      () => {},
    );

    expect(container.setValue).not.toHaveBeenCalled();
  });

  it('handles a config that never set the plugin option at all', async () => {
    const reader = createMarkdownPluginReader();
    const container = makeContainer();

    await reader.read(
      container as never,
      undefined as never,
      '',
      () => {},
    );

    expect(container.setValue).toHaveBeenCalledWith('plugin', [
      'typedoc-plugin-markdown',
    ]);
  });
});

// Regression test for a real TypeDoc bootstrap: when a user-supplied
// `configPath` (typedoc.json) declares its own `plugin` list that omits
// `typedoc-plugin-markdown`, TypeDoc's built-in `TypeDocReader` overwrites
// the `plugin` option we pass in *before* plugins are loaded. Without
// re-asserting the markdown plugin via a higher-order reader (see
// `createMarkdownPluginReader`), the `markdown` output is never registered
// and generation fails once the `markdown` theme/output is requested.
describe('typedoc bootstrap with a configPath that omits the markdown plugin', () => {
  it('still produces markdown output', async () => {
    const { Application, PackageJsonReader, TSConfigReader, TypeDocReader } =
      await import('typedoc');

    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'orval-typedoc-'));
    try {
      const entryFile = path.join(tmpDir, 'index.ts');
      await fs.writeFile(entryFile, 'export interface Foo {\n  bar: string;\n}\n');
      await fs.writeJson(path.join(tmpDir, 'tsconfig.json'), {
        compilerOptions: { strict: true },
        files: ['index.ts'],
      });

      const configFile = path.join(tmpDir, 'typedoc.json');
      // Deliberately omits `typedoc-plugin-markdown` to reproduce the bug.
      await fs.writeJson(configFile, {
        plugin: ['typedoc-plugin-coverage'],
      });

      const outDir = path.join(tmpDir, 'docs');

      const options = getDocsTypedocOptions([entryFile], {
        options: configFile,
        tsconfig: path.join(tmpDir, 'tsconfig.json'),
        theme: 'markdown',
        out: outDir,
      });

      const app = await Application.bootstrapWithPlugins(options, [
        new TypeDocReader(),
        new PackageJsonReader(),
        new TSConfigReader(),
        createMarkdownPluginReader(),
      ]);
      app.options.setValue('readme', 'none');
      app.options.setValue('logLevel', 'None');

      const project = await app.convert();
      expect(project).toBeTruthy();

      app.outputs.setDefaultOutputName(
        getDocsOutputName(app.options.getValue('theme')),
      );

      await expect(app.generateOutputs(project!)).resolves.not.toThrow();

      const files = await fs.readdir(outDir);
      expect(files.length).toBeGreaterThan(0);
    } finally {
      await fs.remove(tmpDir);
    }
  }, 30_000);
});
