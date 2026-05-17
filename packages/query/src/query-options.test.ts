import type { GetterParams, PackageJson } from '@orval/core';
import { describe, expect, it } from 'vitest';

import { createFrameworkAdapter } from './frameworks';
import {
  generateQueryOptions,
  getQueryOptionsDefinition,
  QueryType,
} from './query-options';

const param = (name: string): GetterParams[number] => ({
  name,
  definition: `${name}: number`,
  implementation: `${name}: number`,
  default: undefined,
  required: true,
  imports: [],
});

describe('generateQueryOptions enabled emission (issue #3241)', () => {
  it('emits a null check for a single param so falsy values like 0 do not disable the query', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });
    const out = generateQueryOptions({
      params: [param('petId')],
      options: undefined,
      type: QueryType.QUERY,
      adapter,
    });
    expect(out).toContain('enabled: petId !== null && petId !== undefined,');
    expect(out).not.toContain('!!');
  });

  it('combines null checks with && for multiple params', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });
    const out = generateQueryOptions({
      params: [param('version'), param('petId')],
      options: undefined,
      type: QueryType.QUERY,
      adapter,
    });
    expect(out).toContain(
      'enabled: version !== null && version !== undefined && petId !== null && petId !== undefined,',
    );
  });

  it('wraps with computed and unref for vue-query', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'vue-query' });
    const out = generateQueryOptions({
      params: [param('petId')],
      options: undefined,
      type: QueryType.QUERY,
      adapter,
    });
    expect(out).toContain(
      'enabled: computed(() => unref(petId) !== null && unref(petId) !== undefined),',
    );
  });

  it('respects user-provided enabled option (no auto-emit)', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });
    const out = generateQueryOptions({
      params: [param('petId')],
      options: { enabled: true },
      type: QueryType.QUERY,
      adapter,
    });
    expect(out).not.toContain('petId !== null');
  });
});

describe('getQueryOptionsDefinition — solid-query type names (issue #3365)', () => {
  const solidPkg = (version: string): PackageJson => ({
    resolvedVersions: { '@tanstack/solid-query': version },
  });

  const buildArgs = (adapter: ReturnType<typeof createFrameworkAdapter>) => ({
    operationName: 'createPet',
    definitions: 'data: Pet',
    prefix: adapter.getQueryOptionsDefinitionPrefix(),
    hasQueryV5: adapter.hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError:
      adapter.hasQueryV5WithInfiniteQueryOptionsError,
    adapter,
  });

  it('uses SolidMutationOptions for the user-facing options.mutation param on solid-query <5.100.6 (not the Accessor UseMutationOptions)', () => {
    const adapter = createFrameworkAdapter({
      outputClient: 'solid-query',
      packageJson: solidPkg('5.99.0'),
    });
    const out = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      isReturnType: false,
    });
    expect(out).toContain('SolidMutationOptions<');
    expect(out).not.toContain('UseMutationOptions<');
  });

  it('uses SolidMutationOptions for the helper return type on solid-query <5.100.6', () => {
    const adapter = createFrameworkAdapter({
      outputClient: 'solid-query',
      packageJson: solidPkg('5.99.0'),
    });
    const out = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      isReturnType: true,
    });
    expect(out).toContain('SolidMutationOptions<');
  });

  it('uses MutationOptions (no Solid prefix) for solid-query >=5.100.6', () => {
    const adapter = createFrameworkAdapter({
      outputClient: 'solid-query',
      packageJson: solidPkg('5.100.6'),
    });
    const userFacing = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      isReturnType: false,
    });
    const returnType = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      isReturnType: true,
    });
    expect(userFacing).toContain('MutationOptions<');
    expect(userFacing).not.toContain('SolidMutationOptions<');
    expect(userFacing).not.toContain('UseMutationOptions<');
    expect(returnType).toContain('MutationOptions<');
    expect(returnType).not.toContain('SolidMutationOptions<');
  });

  it('keeps the Accessor-shape Partial<UseQueryOptions<…>> for the user-facing options.query param on solid-query (preserves useQuery overload discrimination)', () => {
    const adapter = createFrameworkAdapter({
      outputClient: 'solid-query',
      packageJson: solidPkg('5.99.0'),
    });
    const out = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      type: QueryType.QUERY,
      isReturnType: false,
    });
    expect(out).toContain('Partial<UseQueryOptions<');
  });

  it('emits SolidQueryOptions<…> for the helper return type on solid-query (isReturnType true)', () => {
    const adapter = createFrameworkAdapter({
      outputClient: 'solid-query',
      packageJson: solidPkg('5.99.0'),
    });
    const out = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      type: QueryType.QUERY,
      isReturnType: true,
    });
    expect(out).toContain('SolidQueryOptions<');
  });

  it('emits QueryOptions<…> (renamed) for the helper return type on solid-query >=5.100.6', () => {
    const adapter = createFrameworkAdapter({
      outputClient: 'solid-query',
      packageJson: solidPkg('5.100.10'),
    });
    const out = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      type: QueryType.QUERY,
      isReturnType: true,
    });
    expect(out).toContain('QueryOptions<');
    expect(out).not.toContain('SolidQueryOptions<');
  });

  it('leaves react-query emitting Partial<UseQueryOptions<…>> for the user-facing param under v5 (UseQueryOptions IS the plain options in react-query)', () => {
    const adapter = createFrameworkAdapter({
      outputClient: 'react-query',
      packageJson: {
        resolvedVersions: { '@tanstack/react-query': '5.90.0' },
      } as PackageJson,
    });
    const out = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      type: QueryType.QUERY,
      isReturnType: false,
    });
    expect(out).toContain('Partial<UseQueryOptions<');
  });

  it('leaves react-query emitting UseMutationOptions<…> for the user-facing mutation param', () => {
    const adapter = createFrameworkAdapter({ outputClient: 'react-query' });
    const out = getQueryOptionsDefinition({
      ...buildArgs(adapter),
      isReturnType: false,
    });
    expect(out).toContain('UseMutationOptions<');
  });
});
