import { generateDependencyImports, type PackageJson } from '@orval/core';
import { describe, expect, it } from 'vite-plus/test';

import {
  getAngularQueryDependencies,
  getVueQueryDependencies,
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
// happens only for mutation invalidation (`const queryClient =
// inject(QueryClient)`). The prefetch helpers name it in parameter and return
// annotations only, so a `usePrefetch`-without-invalidation output that
// imports it as a value trips `consistent-type-imports` in the consumer's
// linter — and in this repo's own, whose autofix then rewrites the committed
// snapshot out from under the generator.
describe('getAngularQueryDependencies', () => {
  const angularQueryImports = (
    implementation: string,
    override?: Parameters<typeof getAngularQueryDependencies>[5],
  ) =>
    generateDependencyImports(
      implementation,
      getAngularQueryDependencies(
        false,
        false,
        undefined,
        undefined,
        false,
        override,
      ).filter(
        (dep) => dep.dependency === '@tanstack/angular-query-experimental',
      ),
      undefined,
      false,
      false,
    );

  const withInvalidates = {
    query: {
      mutationInvalidates: [
        { onMutations: ['createPet'], invalidates: ['listPets'] },
      ],
    },
    operations: {},
    tags: {},
  } as unknown as Parameters<typeof getAngularQueryDependencies>[5];

  it('imports QueryClient as a type when nothing injects it', () => {
    const result = angularQueryImports(
      'export const prefetch = async (queryClient: QueryClient): Promise<QueryClient> => {};',
    );

    expect(result).toContain('import type');
    expect(result).toMatch(/import type \{[^}]*\bQueryClient\b/s);
    expect(result).not.toMatch(/import \{[^}]*\bQueryClient\b/s);
  });

  it('imports QueryClient as a value when a mutation invalidates', () => {
    const result = angularQueryImports(
      'const queryClient = inject(QueryClient);',
      withInvalidates,
    );

    expect(result).toMatch(/import \{[^}]*\bQueryClient\b/s);
  });

  it('keeps QueryClient a value for the prefetch types too once injected', () => {
    // One file can hold both uses; the value import covers the annotations.
    const result = angularQueryImports(
      'const queryClient = inject(QueryClient);\n' +
        'export const prefetch = async (qc: QueryClient): Promise<QueryClient> => {};',
      withInvalidates,
    );

    expect(result).toMatch(/import \{[^}]*\bQueryClient\b/s);
    expect(result).not.toMatch(/import type \{[^}]*\bQueryClient\b/s);
  });
});
