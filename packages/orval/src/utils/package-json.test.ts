import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isString as isRemedaString } from 'remeda';

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
}));

vi.mock('./options', () => ({
  normalizePath: (p: string) => p,
}));

import { findUp, findUpMultiple } from 'find-up';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { dynamicImport, log } from '@orval/core';

import { loadPackageJson } from './package-json';

describe('loadPackageJson - catalog resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue(
        'catalog:\n  react: "^18.2.0"' as any,
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return undefined;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return undefined;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return '/workspace/.yarnrc.yml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });
      vi.mocked(findUpMultiple).mockResolvedValue(['/workspace/package.json']);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson).mockResolvedValue({});
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });
      vi.mocked(findUpMultiple).mockResolvedValue(['/workspace/package.json']);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return '/workspace/.yarnrc.yml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });
      vi.mocked(findUpMultiple).mockResolvedValue(['/workspace/package.json']);

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readJson).mockResolvedValue({
        catalog: { react: '^19.0.0' },
      });
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml')
          return '/workspace/pnpm-workspace.yaml';
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
      });

      vi.mocked(dynamicImport).mockResolvedValue(mockPkg);
      vi.mocked(fs.readFile).mockResolvedValue('' as any);
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return undefined;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return undefined;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/feature/submodule/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return undefined;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return undefined;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return undefined;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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

      vi.mocked(findUp).mockImplementation(async (name) => {
        if (name === 'pnpm-workspace.yaml') return undefined;
        if (name === '.yarnrc.yml') return undefined;
        if (Array.isArray(name) && name.includes('package.json'))
          return '/workspace/packages/app/package.json';
        return undefined;
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
