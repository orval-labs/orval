import { describe, expect, it } from 'vitest';

import {
  resolveInstalledVersion,
  resolveInstalledVersions,
} from './resolve-version';
import type { PackageJson } from '../types';

const projectDir = process.cwd();

describe('resolveInstalledVersion', () => {
  it('resolves version for package with direct package.json access', () => {
    const version = resolveInstalledVersion('vitest', projectDir);
    expect(version).toBeDefined();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('resolves version for package with exports field blocking', () => {
    const version = resolveInstalledVersion('remeda', projectDir);
    expect(version).toBeDefined();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns undefined for non-installed package', () => {
    const version = resolveInstalledVersion('nonexistent-pkg-xyz', projectDir);
    expect(version).toBeUndefined();
  });

  it('resolves scoped package', () => {
    const version = resolveInstalledVersion(
      '@tanstack/react-query',
      projectDir,
    );
    expect(version).toBeDefined();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('does not throw for any failure case', () => {
    expect(() =>
      resolveInstalledVersion('nonexistent-pkg-xyz', projectDir),
    ).not.toThrow();
    expect(() =>
      resolveInstalledVersion('another-fake-package', '/nonexistent/path'),
    ).not.toThrow();
  });
});

describe('resolveInstalledVersions', () => {
  it('batch resolves from PackageJson-shaped object', () => {
    const packageJson: PackageJson = {
      dependencies: { vitest: '^4.0.0', remeda: '^2.0.0' },
      devDependencies: { 'nonexistent-pkg-xyz': '*' },
    };
    const result = resolveInstalledVersions(packageJson, projectDir);
    expect(result).toHaveProperty('vitest');
    expect(result).toHaveProperty('remeda');
    expect(result).not.toHaveProperty('nonexistent-pkg-xyz');
    expect(result['vitest']).toMatch(/^\d+\.\d+\.\d+/);
    expect(result['remeda']).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('returns empty object when no dependencies', () => {
    const result = resolveInstalledVersions({}, projectDir);
    expect(result).toEqual({});
  });

  it('deduplicates packages appearing in multiple dependency groups', () => {
    const packageJson: PackageJson = {
      dependencies: { vitest: '^4.0.0' },
      devDependencies: { vitest: '^4.0.0' },
    };
    const result = resolveInstalledVersions(packageJson, projectDir);
    const keys = Object.keys(result).filter((k) => k === 'vitest');
    expect(keys).toHaveLength(1);
    expect(result['vitest']).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('PackageJson type', () => {
  it('accepts resolvedVersions field', () => {
    const pkg: PackageJson = {
      dependencies: {},
      resolvedVersions: { vitest: '4.0.16' },
    };
    expect(pkg.resolvedVersions).toBeDefined();
    expect(pkg.resolvedVersions!['vitest']).toBe('4.0.16');
  });
});
