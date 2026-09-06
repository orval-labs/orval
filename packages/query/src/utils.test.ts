import vm from 'node:vm';

import { describe, expect, it } from 'vite-plus/test';

import type { GeneratorMutator } from '@orval/core';

import {
  getOperationMetaLiteral,
  normalizeQueryOptions,
  shouldUseOptionsHook,
} from './utils';

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

  it('accepts the deprecated shouldExportQueryKey alias', () => {
    const result = normalizeQueryOptions(
      { shouldExportQueryKey: true },
      '/workspace',
    );
    expect(result.shouldExportKeys).toBe(true);
  });

  it('prefers shouldExportKeys over the deprecated alias', () => {
    const result = normalizeQueryOptions(
      { shouldExportKeys: true, shouldExportQueryKey: false },
      '/workspace',
    );
    expect(result.shouldExportKeys).toBe(true);
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

describe('getOperationMetaLiteral', () => {
  // Evaluate the emitted fragment the way the generated hook would, so the
  // assertions are about what the object actually becomes rather than about
  // the escaping mechanics. `injected` records any code that broke out.
  const evaluate = (literal: string) => {
    const context = vm.createContext({ injected: false });
    return vm.runInContext(`({ ${literal} })`, context) as Record<
      string,
      unknown
    > & { injected?: unknown };
  };

  it('emits a plain operationId and operationName unchanged', () => {
    expect(getOperationMetaLiteral('getPets', 'getPets')).toBe(
      "operationId: 'getPets', operationName: 'getPets'",
    );
  });

  it('escapes a quote in the operationId so it cannot inject object entries', () => {
    const operationId = "getPets',x:(()=>{throw new Error('pwned')})(),y:'";
    const parsed = evaluate(getOperationMetaLiteral(operationId, 'getPets'));

    // The whole spec value has to stay inside the operationId string: an
    // unescaped quote would add `x`/`y` keys and run the IIFE.
    expect(Object.keys(parsed)).toEqual(['operationId', 'operationName']);
    expect(parsed.operationId).toBe(operationId);
  });

  it('escapes a quote in the operationName', () => {
    const operationName = "getPets','z':'";
    const parsed = evaluate(getOperationMetaLiteral('getPets', operationName));

    expect(Object.keys(parsed)).toEqual(['operationId', 'operationName']);
    expect(parsed.operationName).toBe(operationName);
  });

  it('escapes a backslash so it cannot escape the closing quote', () => {
    const parsed = evaluate(getOperationMetaLiteral('getPets\\', 'getPets'));

    expect(Object.keys(parsed)).toEqual(['operationId', 'operationName']);
    expect(parsed.operationId).toBe('getPets\\');
  });
});
