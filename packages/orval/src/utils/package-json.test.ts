import { isString as isRemedaString } from 'remeda';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock modules before imports
vi.mock('find-up', () => ({
  findUp: vi.fn(),
  findUpMultiple: vi.fn(),
}));

vi.mock('fs-extra', () => ({
  default: {
    readFile: vi.fn(),
    readJson: vi.fn(),
    existsSync: vi.fn(),
  },
}));

vi.mock('js-yaml', () => ({
  default: {
    load: vi.fn(),
  },
}));

vi.mock('@orval/core', () => ({
  dynamicImport: vi.fn(),
  isObject: (v: unknown) =>
    Object.prototype.toString.call(v) === '[object Object]',
  isString: isRemedaString,
  log: vi.fn(),
  logVerbose: vi.fn(),
  resolveInstalledVersions: vi.fn().mockReturnValue({}),
}));

vi.mock('./options', () => ({
  normalizePath: (p: string) => p,
}));

import {
  dynamicImport,
  log,
  logVerbose,
  resolveInstalledVersions,
} from '@orval/core';
import { findUp, findUpMultiple } from 'find-up';
import fs from 'fs-extra';
import yaml from 'js-yaml';

import { _resetResolvedCache, loadPackageJson } from './package-json.ts';

describe('loadPackageJson - catalog resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetResolvedCache();
    vi.mocked(resolveInstalledVersions).mockReturnValue({});
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('pnpm-workspace.yaml catalogs', () => {
    it('should resolve catalog: from pnpm-workspace.yaml default catalog', async () => {
      const mockPkg = {
        dependencies: {
          react: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(
        Buffer.from('catalog:\n  react: "^18.2.0"'),
      );
      vi.mocked(yaml.load).mockReturnValue({
        catalog: { react: '^18.2.0' },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.react).toBe('^18.2.0');
    });

    it('should resolve catalog:default from pnpm-workspace.yaml', async () => {
      const mockPkg = {
        dependencies: {
          react: 'catalog:default',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalog: { react: '^18.2.0' },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.react).toBe('^18.2.0');
    });

    it('should resolve named catalog from pnpm-workspace.yaml', async () => {
      const mockPkg = {
        devDependencies: {
          jest: 'catalog:testing',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalogs: {
          testing: { jest: '^29.0.0' },
        },
      });

      const result = await loadPackageJson();

      expect(result?.devDependencies?.jest).toBe('^29.0.0');
    });

    it('should warn when package is missing from default catalog', async () => {
      const mockPkg = {
        dependencies: {
          lodash: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalog: { react: '^18.2.0' },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.lodash).toBe('catalog:');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('no matching package in the default catalog'),
      );
    });
  });

  describe('package.json catalogs (Bun)', () => {
    it('should resolve catalog: from root package.json when no pnpm-workspace.yaml', async () => {
      const mockPkg = {
        dependencies: {
          react: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue(['/workspace/package.json']);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson).mockResolvedValue({
        catalog: { react: '^19.0.0' },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.react).toBe('^19.0.0');
    });

    it('should resolve named catalog from root package.json', async () => {
      const mockPkg = {
        devDependencies: {
          vitest: 'catalog:testing',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue(['/workspace/package.json']);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson).mockResolvedValue({
        catalogs: {
          testing: { vitest: '^2.0.0' },
        },
      });

      const result = await loadPackageJson();

      expect(result?.devDependencies?.vitest).toBe('^2.0.0');
    });
  });

  describe('.yarnrc.yml catalogs (Yarn Berry)', () => {
    it('should resolve catalog: from .yarnrc.yml when no other sources', async () => {
      const mockPkg = {
        dependencies: {
          typescript: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return '/workspace/.yarnrc.yml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue(['/workspace/package.json']);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson).mockResolvedValue({});
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalog: { typescript: '5.9.3' },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.typescript).toBe('5.9.3');
    });
  });

  describe('priority and fallback', () => {
    it('should use pnpm-workspace.yaml over package.json catalogs', async () => {
      const mockPkg = {
        dependencies: {
          react: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue(['/workspace/package.json']);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalog: { react: '^18.0.0' },
      });
      vi.mocked(fs.readJson).mockResolvedValue({
        catalog: { react: '^19.0.0' },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.react).toBe('^18.0.0');
    });

    it('should use package.json catalogs over .yarnrc.yml catalogs', async () => {
      const mockPkg = {
        dependencies: {
          react: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return '/workspace/.yarnrc.yml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue(['/workspace/package.json']);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson).mockResolvedValue({
        catalog: { react: '^19.0.0' },
      });
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalog: { react: '^18.0.0' },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.react).toBe('^19.0.0');
    });
  });

  describe('edge cases', () => {
    it('should return package unchanged when no catalog: references', async () => {
      const mockPkg = {
        dependencies: {
          react: '^18.2.0',
          lodash: '4.17.21',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);

      const result = await loadPackageJson();

      expect(result).toEqual(mockPkg);
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should warn when no catalog source is found', async () => {
      const mockPkg = {
        dependencies: {
          react: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue([]);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);

      const result = await loadPackageJson();

      expect(result?.dependencies?.react).toBe('catalog:');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('no catalog source was found'),
      );
    });

    it('should handle mixed catalog and hardcoded versions', async () => {
      const mockPkg = {
        dependencies: {
          react: 'catalog:',
          lodash: '4.17.21',
        },
        devDependencies: {
          typescript: 'catalog:',
          prettier: '3.0.0',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalog: {
          react: '^18.2.0',
          typescript: '5.0.0',
        },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.react).toBe('^18.2.0');
      expect(result?.dependencies?.lodash).toBe('4.17.21');
      expect(result?.devDependencies?.typescript).toBe('5.0.0');
      expect(result?.devDependencies?.prettier).toBe('3.0.0');
    });

    it('should warn when named catalog does not exist', async () => {
      const mockPkg = {
        dependencies: {
          jest: 'catalog:nonexistent',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalogs: {
          testing: { vitest: '^2.0.0' },
        },
      });

      const result = await loadPackageJson();

      expect(result?.dependencies?.jest).toBe('catalog:nonexistent');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining("no matching catalog named 'nonexistent'"),
      );
    });

    it('should handle peerDependencies with catalog references', async () => {
      const mockPkg = {
        peerDependencies: {
          react: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
      vi.mocked(yaml.load).mockReturnValue({
        catalog: { react: '^18.0.0' },
      });

      const result = await loadPackageJson();

      expect(result?.peerDependencies?.react).toBe('^18.0.0');
    });
  });

  describe('nested workspace package.json resolution', () => {
    it('should find catalogs in root package.json when nested package.json has none', async () => {
      const mockPkg = {
        dependencies: {
          react: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue([
        '/workspace/packages/app/package.json',
        '/workspace/package.json',
      ]);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson)
        .mockResolvedValueOnce({}) // nested package.json - no catalogs
        .mockResolvedValueOnce({
          catalog: { react: '^19.0.0' },
        }); // root package.json - has catalogs

      const result = await loadPackageJson();

      expect(result?.dependencies?.react).toBe('^19.0.0');
    });

    it('should find catalogs through multiple nesting levels', async () => {
      const mockPkg = {
        dependencies: {
          lodash: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/feature/submodule/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue([
        '/workspace/packages/feature/submodule/package.json',
        '/workspace/packages/feature/package.json',
        '/workspace/packages/package.json',
        '/workspace/package.json',
      ]);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson)
        .mockResolvedValueOnce({}) // deepest - no catalogs
        .mockResolvedValueOnce({}) // middle - no catalogs
        .mockResolvedValueOnce({}) // packages - no catalogs
        .mockResolvedValueOnce({
          catalog: { lodash: '^4.17.21' },
        }); // root - has catalogs

      const result = await loadPackageJson();

      expect(result?.dependencies?.lodash).toBe('^4.17.21');
    });

    it('should stop at first package.json with catalogs (not necessarily root)', async () => {
      const mockPkg = {
        dependencies: {
          axios: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue([
        '/workspace/packages/app/package.json',
        '/workspace/packages/package.json',
        '/workspace/package.json',
      ]);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson)
        .mockResolvedValueOnce({}) // app - no catalogs
        .mockResolvedValueOnce({
          catalog: { axios: '^1.5.0' },
        }); // packages - has catalogs (should stop here)

      const result = await loadPackageJson();

      expect(result?.dependencies?.axios).toBe('^1.5.0');
      expect(fs.readJson).toHaveBeenCalledTimes(2);
    });

    it('should return undefined when no package.json has catalogs', async () => {
      const mockPkg = {
        dependencies: {
          express: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue([
        '/workspace/packages/app/package.json',
        '/workspace/package.json',
      ]);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson)
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({});

      const result = await loadPackageJson();

      expect(result?.dependencies?.express).toBe('catalog:');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('no catalog source was found'),
      );
    });

    it('should continue to next file when one throws an error', async () => {
      const mockPkg = {
        dependencies: {
          typescript: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue([
        '/workspace/packages/app/package.json',
        '/workspace/package.json',
      ]);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson)
        .mockRejectedValueOnce(new Error('ENOENT'))
        .mockResolvedValueOnce({
          catalog: { typescript: '^5.0.0' },
        });

      const result = await loadPackageJson();

      expect(result?.dependencies?.typescript).toBe('^5.0.0');
    });

    it('should return undefined when findUpMultiple returns empty array', async () => {
      const mockPkg = {
        dependencies: {
          zod: 'catalog:',
        },
      };

      vi.mocked(findUp).mockImplementation((name) => {
        if (name === 'pnpm-workspace.yaml') return;
        if (name === '.yarnrc.yml') return;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return;
      });
      vi.mocked(findUpMultiple).mockResolvedValue([]);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);

      const result = await loadPackageJson();

      expect(result?.dependencies?.zod).toBe('catalog:');
      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('no catalog source was found'),
      );
    });
  });
});

describe('loadPackageJson - version resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetResolvedCache();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should populate resolvedVersions when packages are resolvable', async () => {
    const mockPkg = {
      dependencies: {
        react: '^18.2.0',
        typescript: '^5.0.0',
      },
    };

    vi.mocked(findUp).mockImplementation((name) => {
      if (Array.isArray(name) && name.includes('package.json'))
        return '/workspace/package.json';
      return;
    });
    vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
    vi.mocked(resolveInstalledVersions).mockReturnValue({
      react: '18.3.1',
      typescript: '5.6.3',
    });

    const result = await loadPackageJson();

    expect(resolveInstalledVersions).toHaveBeenCalledWith(
      mockPkg,
      process.cwd(),
    );
    expect(result?.resolvedVersions).toEqual({
      react: '18.3.1',
      typescript: '5.6.3',
    });
  });

  it('should not set resolvedVersions when no packages resolve', async () => {
    const mockPkg = {
      dependencies: {
        'some-private-pkg': '^1.0.0',
      },
    };

    vi.mocked(findUp).mockImplementation((name) => {
      if (Array.isArray(name) && name.includes('package.json'))
        return '/workspace/package.json';
      return;
    });
    vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
    vi.mocked(resolveInstalledVersions).mockReturnValue({});

    const result = await loadPackageJson();

    expect(resolveInstalledVersions).toHaveBeenCalledWith(
      mockPkg,
      process.cwd(),
    );
    expect(result?.resolvedVersions).toBeUndefined();
  });

  it('should verbose-log each resolved version', async () => {
    const mockPkg = {
      dependencies: {
        '@tanstack/react-query': '^5.0.0',
      },
    };

    vi.mocked(findUp).mockImplementation((name) => {
      if (Array.isArray(name) && name.includes('package.json'))
        return '/workspace/package.json';
      return;
    });
    vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
    vi.mocked(resolveInstalledVersions).mockReturnValue({
      '@tanstack/react-query': '5.90.1',
    });

    await loadPackageJson();

    expect(logVerbose).toHaveBeenCalledWith(
      expect.stringContaining('Detected'),
    );
    expect(logVerbose).toHaveBeenCalledWith(
      expect.stringContaining('@tanstack/react-query'),
    );
    expect(logVerbose).toHaveBeenCalledWith(expect.stringContaining('v5.90.1'));
    expect(log).not.toHaveBeenCalledWith(expect.stringContaining('Detected'));
  });

  it('should resolve versions only once per package.json path (caching)', async () => {
    const mockPkg = {
      dependencies: { react: '^18.0.0' },
    };

    vi.mocked(findUp).mockImplementation((name) => {
      if (Array.isArray(name) && name.includes('package.json'))
        return '/cached-workspace/package.json';
      return;
    });
    vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
    vi.mocked(resolveInstalledVersions).mockReturnValue({
      react: '18.3.1',
    });

    const result1 = await loadPackageJson(undefined, '/cached-workspace');
    const result2 = await loadPackageJson(undefined, '/cached-workspace');

    expect(resolveInstalledVersions).toHaveBeenCalledTimes(1);
    expect(result1?.resolvedVersions).toEqual({ react: '18.3.1' });
    expect(result2?.resolvedVersions).toEqual({ react: '18.3.1' });
  });

  it('should not reuse cached versions across different package.json files in the same workspace', async () => {
    const pkgA = {
      dependencies: { react: '^18.0.0' },
    };
    const pkgB = {
      dependencies: { vue: '^3.0.0' },
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(dynamicImport).mockImplementation((path) => {
      if (path === 'apps/app-a/package.json') return pkgA;
      return pkgB;
    });
    vi.mocked(resolveInstalledVersions).mockImplementation((pkg) => {
      if (pkg === pkgA) return { react: '18.3.1' };
      if (pkg === pkgB) return { vue: '3.5.13' };
      return {};
    });

    const resultA = await loadPackageJson('apps/app-a/package.json', '/repo');
    const resultB = await loadPackageJson('apps/app-b/package.json', '/repo');

    expect(resolveInstalledVersions).toHaveBeenCalledTimes(2);
    expect(resultA?.resolvedVersions).toEqual({ react: '18.3.1' });
    expect(resultB?.resolvedVersions).toEqual({ vue: '3.5.13' });
  });

  it('should pass workspace directory to resolveInstalledVersions', async () => {
    const mockPkg = {
      dependencies: { react: '^18.0.0' },
    };
    const customWorkspace = '/custom/workspace/path';

    vi.mocked(findUp).mockImplementation((name) => {
      if (Array.isArray(name) && name.includes('package.json'))
        return '/custom/workspace/path/package.json';
      return;
    });
    vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
    vi.mocked(resolveInstalledVersions).mockReturnValue({
      react: '18.3.1',
    });

    await loadPackageJson(undefined, customWorkspace);

    expect(resolveInstalledVersions).toHaveBeenCalledWith(
      mockPkg,
      customWorkspace,
    );
  });

  it('should resolve versions after catalog substitution', async () => {
    const mockPkg = {
      dependencies: {
        react: 'catalog:',
      },
    };

    vi.mocked(findUp).mockImplementation((name) => {
      if (name === 'pnpm-workspace.yaml')
        return '/workspace/pnpm-workspace.yaml';
      if (Array.isArray(name) && name.includes('package.json'))
        return '/workspace/package.json';
      return;
    });
    vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
    vi.mocked(fs.readFile).mockResolvedValue(Buffer.from(''));
    vi.mocked(yaml.load).mockReturnValue({
      catalog: { react: '^18.2.0' },
    });
    vi.mocked(resolveInstalledVersions).mockReturnValue({
      react: '18.3.1',
    });

    const result = await loadPackageJson();

    // Catalog substitution happened first
    expect(result?.dependencies?.react).toBe('^18.2.0');
    // Then version resolution ran on the substituted package
    expect(result?.resolvedVersions).toEqual({ react: '18.3.1' });
    // resolveInstalledVersions received the catalog-resolved pkg (not the raw catalog: reference)
    expect(
      vi.mocked(resolveInstalledVersions).mock.calls[0]?.[0]?.dependencies
        ?.react,
    ).toBe('^18.2.0');
  });

  it('should resolve versions when using explicit package.json path', async () => {
    const mockPkg = {
      dependencies: { lodash: '^4.17.21' },
    };

    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
    vi.mocked(resolveInstalledVersions).mockReturnValue({
      lodash: '4.17.21',
    });

    const result = await loadPackageJson('/explicit/package.json', '/explicit');

    expect(resolveInstalledVersions).toHaveBeenCalledWith(mockPkg, '/explicit');
    expect(result?.resolvedVersions).toEqual({ lodash: '4.17.21' });
  });
});
