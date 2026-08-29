import { describe, expect, it } from 'vite-plus/test';

import type { GeneratorMutator } from '@orval/core';

import { normalizeQueryOptions, shouldUseOptionsHook } from './utils';

describe('normalizeQueryOptions', () => {
  it('preserves useHooks for options mutators', () => {
    const result = normalizeQueryOptions(
      {
        queryOptions: {
          path: './query-options.ts',
          name: 'customQueryOptions',
          useHooks: false,
        },
      },
      '/workspace',
    );

    expect(result.queryOptions?.useHooks).toBe(false);
  });

  it('should include useOperationIdAsQueryKey when provided', () => {
    const result = normalizeQueryOptions(
      { useOperationIdAsQueryKey: true },
      '/workspace',
    );
    expect(result.useOperationIdAsQueryKey).toBe(true);
  });

  it('should not include useOperationIdAsQueryKey when false', () => {
    const result = normalizeQueryOptions(
      { useOperationIdAsQueryKey: false },
      '/workspace',
    );
    expect(result.useOperationIdAsQueryKey).toBeUndefined();
  });

  it('should not include useOperationIdAsQueryKey when not provided', () => {
    const result = normalizeQueryOptions({}, '/workspace');
    expect(result.useOperationIdAsQueryKey).toBeUndefined();
  });
});

describe('shouldUseOptionsHook', () => {
  const mutator: GeneratorMutator = {
    name: 'customMutator',
    path: './custom-mutator',
    default: false,
    hasErrorType: false,
    errorTypeName: '',
    hasSecondArg: false,
    hasThirdArg: false,
    isHook: false,
  };

  it.each([
    [
      'uses hooks when the options mutator omits useHooks',
      true,
      {},
      undefined,
      undefined,
    ],
    [
      'uses hooks when the options mutator enables useHooks',
      true,
      { useHooks: true },
      undefined,
      undefined,
    ],
    [
      'does not use hooks when the options mutator disables useHooks',
      false,
      { useHooks: false },
      undefined,
      undefined,
    ],
    [
      'disables query hooks when the query-key mutator would use hooks',
      false,
      { useHooks: false },
      mutator,
      undefined,
    ],
    [
      'disables mutation hooks when the base mutator would use hooks',
      false,
      { useHooks: false },
      undefined,
      { ...mutator, isHook: true },
    ],
    [
      'falls back to the query-key mutator when no options mutator exists',
      true,
      undefined,
      mutator,
      undefined,
    ],
    [
      'falls back to the base mutator when no options or query-key mutator exists',
      true,
      undefined,
      undefined,
      { ...mutator, isHook: true },
    ],
  ])('%s', (_name, expected, optionsMutator, queryKeyMutator, baseMutator) => {
    expect(
      shouldUseOptionsHook({
        optionsMutator: optionsMutator && { ...mutator, ...optionsMutator },
        queryKeyMutator,
        mutator: baseMutator,
      }),
    ).toBe(expected);
  });
});
