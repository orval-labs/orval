import { type PackageJson } from '@orval/core';
import { describe, expect, it } from 'vitest';

import {
  isQueryV5,
  isQueryV5WithDataTagError,
  isQueryV5WithInfiniteQueryOptionsError,
  isSolidQueryWithRenamedOptionsTypes,
  isSolidQueryWithUsePrefix,
} from './dependencies';

describe('isQueryV5', () => {
  it('should return true when resolvedVersions has v5 (no dependencies)', () => {
    const packageJson: PackageJson = {
      resolvedVersions: {
        '@tanstack/react-query': '5.90.1',
      },
    };

    expect(isQueryV5(packageJson, 'react-query')).toBe(true);
  });

  it('should return true via fallback when resolvedVersions is absent and dependencies has v5', () => {
    const packageJson: PackageJson = {
      dependencies: {
        '@tanstack/react-query': '5.4.0',
      },
    };

    expect(isQueryV5(packageJson, 'react-query')).toBe(true);
  });

  it('should return true with vue-query client type via resolvedVersions', () => {
    const packageJson: PackageJson = {
      resolvedVersions: {
        '@tanstack/vue-query': '5.90.0',
      },
    };

    expect(isQueryV5(packageJson, 'vue-query')).toBe(true);
  });

  it('should return false when no version info is present', () => {
    const packageJson: PackageJson = {
      dependencies: {
        'other-package': '1.0.0',
      },
    };

    expect(isQueryV5(packageJson, 'react-query')).toBe(false);
  });
});

describe('isQueryV5WithInfiniteQueryOptionsError', () => {
  it('should return true when resolvedVersions has 5.90.1 even if dependencies has ^5.0.0', () => {
    const packageJson: PackageJson = {
      dependencies: {
        '@tanstack/react-query': '^5.0.0',
      },
      resolvedVersions: {
        '@tanstack/react-query': '5.90.1',
      },
    };

    expect(
      isQueryV5WithInfiniteQueryOptionsError(packageJson, 'react-query'),
    ).toBe(true);
  });

  it('should return false when only dependencies has ^5.0.0 (no resolvedVersions)', () => {
    const packageJson: PackageJson = {
      dependencies: {
        '@tanstack/react-query': '^5.0.0',
      },
    };

    // ^5.0.0 stripped to 5.0.0 by compareVersions, which is < 5.80.0
    expect(
      isQueryV5WithInfiniteQueryOptionsError(packageJson, 'react-query'),
    ).toBe(false);
  });

  it('should always return true for angular-query', () => {
    const packageJson: PackageJson = {};

    expect(
      isQueryV5WithInfiniteQueryOptionsError(packageJson, 'angular-query'),
    ).toBe(true);
  });
});

describe('isQueryV5WithDataTagError', () => {
  it('should return true when resolvedVersions has 5.62.0+ even if dependencies floor is below', () => {
    const packageJson: PackageJson = {
      dependencies: {
        '@tanstack/react-query': '^5.0.0',
      },
      resolvedVersions: {
        '@tanstack/react-query': '5.62.0',
      },
    };

    expect(isQueryV5WithDataTagError(packageJson, 'react-query')).toBe(true);
  });

  it('should return false when only dependencies has ^5.0.0 (no resolvedVersions)', () => {
    const packageJson: PackageJson = {
      dependencies: {
        '@tanstack/react-query': '^5.0.0',
      },
    };

    // ^5.0.0 stripped to 5.0.0 by compareVersions, which is < 5.62.0
    expect(isQueryV5WithDataTagError(packageJson, 'react-query')).toBe(false);
  });
});

describe('isSolidQueryWithUsePrefix', () => {
  it('should return true for 5.71.5 (boundary)', () => {
    const packageJson: PackageJson = {
      resolvedVersions: { '@tanstack/solid-query': '5.71.5' },
    };
    expect(isSolidQueryWithUsePrefix(packageJson)).toBe(true);
  });

  it('should return false for 5.71.4', () => {
    const packageJson: PackageJson = {
      resolvedVersions: { '@tanstack/solid-query': '5.71.4' },
    };
    expect(isSolidQueryWithUsePrefix(packageJson)).toBe(false);
  });

  it('should return false when solid-query is not installed', () => {
    expect(isSolidQueryWithUsePrefix({})).toBe(false);
  });
});

describe('isSolidQueryWithRenamedOptionsTypes', () => {
  it('should return true for 5.100.6 (boundary — Solid prefix dropped)', () => {
    const packageJson: PackageJson = {
      resolvedVersions: { '@tanstack/solid-query': '5.100.6' },
    };
    expect(isSolidQueryWithRenamedOptionsTypes(packageJson)).toBe(true);
  });

  it('should return true for 5.100.10', () => {
    const packageJson: PackageJson = {
      resolvedVersions: { '@tanstack/solid-query': '5.100.10' },
    };
    expect(isSolidQueryWithRenamedOptionsTypes(packageJson)).toBe(true);
  });

  it('should return false for 5.100.5 (just below boundary)', () => {
    const packageJson: PackageJson = {
      resolvedVersions: { '@tanstack/solid-query': '5.100.5' },
    };
    expect(isSolidQueryWithRenamedOptionsTypes(packageJson)).toBe(false);
  });

  it('should return false for 5.90.21 (well below boundary)', () => {
    const packageJson: PackageJson = {
      resolvedVersions: { '@tanstack/solid-query': '5.90.21' },
    };
    expect(isSolidQueryWithRenamedOptionsTypes(packageJson)).toBe(false);
  });

  it('should return false when solid-query is not installed', () => {
    expect(isSolidQueryWithRenamedOptionsTypes({})).toBe(false);
  });
});
