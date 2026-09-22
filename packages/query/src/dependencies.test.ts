import { generateDependencyImports, type PackageJson } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  getAngularQueryDependencies,
  getVueQueryDependencies,
  isQueryV5,
  isQueryV5WithDataTagError,
  isQueryV5WithInfiniteQueryOptionsError,
  isQueryV5WithOptionalOnMutateResult,
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

describe('isQueryV5WithOptionalOnMutateResult', () => {
  const resolvedTo = (version: string): PackageJson => ({
    resolvedVersions: { '@tanstack/react-query': version },
  });

  // 5.89.0 widened `onSuccess`'s third parameter to `TOnMutateResult |
  // undefined`; 5.90.2 narrowed it back. No 5.89.x patch was published, so
  // 5.89.0 and 5.90.1 are the entire window. See #4180.
  it.each(['5.89.0', '5.90.1'])('returns true inside the window (%s)', (v) => {
    expect(
      isQueryV5WithOptionalOnMutateResult(resolvedTo(v), 'react-query'),
    ).toBe(true);
  });

  it.each(['5.88.0', '5.62.16', '5.90.2', '5.92.7', '6.0.0'])(
    'returns false outside the window (%s)',
    (v) => {
      expect(
        isQueryV5WithOptionalOnMutateResult(resolvedTo(v), 'react-query'),
      ).toBe(false);
    },
  );

  it('ignores a prerelease suffix', () => {
    expect(
      isQueryV5WithOptionalOnMutateResult(
        resolvedTo('5.90.1-rc.1'),
        'react-query',
      ),
    ).toBe(true);
  });

  // compareVersions answers true for a version it cannot resolve, so both
  // bounds agree and the unresolvable version must land on the current, narrow
  // shape rather than inside the two-release window.
  it.each(['catalog:react', 'latest', '*'])(
    'treats an unresolvable version (%s) as the current shape',
    (v) => {
      expect(
        isQueryV5WithOptionalOnMutateResult(resolvedTo(v), 'react-query'),
      ).toBe(false);
    },
  );

  it('returns false when the package is absent', () => {
    expect(isQueryV5WithOptionalOnMutateResult({}, 'react-query')).toBe(false);
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

describe('vue reactivity imports tree-shake from the declared superset', () => {
  // `getVueQueryDependencies` declares the full reactivity superset
  // (`MaybeRef`/`unref` and `MaybeRefOrGetter`/`toValue`) unconditionally and
  // relies on `addDependency` to keep only the names that actually appear in
  // the generated code. This pins that contract so the v4/v5 split can never
  // leak an import the output doesn't use (e.g. `toValue` on Vue < 3.3).
  const vueImports = (implementation: string) =>
    generateDependencyImports(
      implementation,
      getVueQueryDependencies(false, false, undefined, undefined).filter(
        (dep) => dep.dependency === 'vue',
      ),
      undefined,
      false,
      false,
    );

  it('imports only MaybeRefOrGetter/toValue for v5-style output', () => {
    const result = vueImports(
      'const x: MaybeRefOrGetter<Foo> = bar; const y = toValue(x); computed(() => y);',
    );
    expect(result).toMatch(/\btoValue\b/);
    expect(result).toMatch(/\bMaybeRefOrGetter\b/);
    expect(result).toMatch(/\bcomputed\b/);
    expect(result).not.toMatch(/\bunref\b/);
    expect(result).not.toMatch(/\bMaybeRef\b/); // standalone MaybeRef, not the OrGetter form
  });

  it('imports only MaybeRef/unref for pre-v5 output', () => {
    const result = vueImports(
      'const x: MaybeRef<Foo> = bar; const y = unref(x); computed(() => y);',
    );
    expect(result).toMatch(/\bunref\b/);
    expect(result).toMatch(/\bMaybeRef\b/);
    expect(result).toMatch(/\bcomputed\b/);
    expect(result).not.toMatch(/\btoValue\b/);
    expect(result).not.toMatch(/\bMaybeRefOrGetter\b/);
  });
});

// `QueryClient` is a value in Angular output only where DI injects it, which
// the generator emits as `const queryClient = inject(QueryClient)` for a
// mutation that invalidates. Everywhere else it is named in parameter and
// return annotations only, so a value import there trips
// `consistent-type-imports` in the consumer's linter — and in this repo's own,
// whose autofix then rewrites the committed snapshot out from under the
// generator.
//
// The question is per file, not per config: with `tags-split` one tag can
// invalidate while its sibling emits no mutation at all, and an override can
// name an operation the spec does not have, so neither answers it. The
// emitted implementation does, the same way `addDependency` already decides
// which names to keep.
describe('getAngularQueryDependencies', () => {
  const angularQueryImports = (implementation: string) =>
    generateDependencyImports(
      implementation,
      getAngularQueryDependencies(
        false,
        false,
        undefined,
        undefined,
        false,
        undefined,
        implementation,
      ).filter(
        (dep) => dep.dependency === '@tanstack/angular-query-experimental',
      ),
      undefined,
      false,
      false,
    );

  // Only `QueryClient` is referenced, so the filtered dependency emits a
  // single import and the whole result is it.
  const prefetchOnly =
    'export const prefetch = async (queryClient: QueryClient): Promise<QueryClient> => {};';

  it('imports QueryClient as a type when nothing injects it', () => {
    const result = angularQueryImports(prefetchOnly);

    expect(result).toContain('QueryClient');
    expect(result).toContain('import type {');
    expect(result).not.toContain('import {');
  });

  it('imports QueryClient as a value when the file injects it', () => {
    const result = angularQueryImports(
      'const queryClient = inject(QueryClient);' + prefetchOnly,
    );

    expect(result).toContain('QueryClient');
    expect(result).toContain('import {');
    expect(result).not.toContain('import type {');
  });
});
