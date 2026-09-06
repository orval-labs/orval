import nodePath from 'node:path';
import { styleText } from 'node:util';

import {
  isObject,
  isString,
  jsStringLiteralEscape,
  type GeneratorMutator,
  type Mutator,
  type NormalizedMutator,
  type NormalizedQueryOptions,
  type QueryOptions,
} from '@orval/core';

export const normalizeQueryOptions = (
  queryOptions: QueryOptions = {},
  outputWorkspace: string,
): NormalizedQueryOptions => {
  return {
    ...(queryOptions.usePrefetch ? { usePrefetch: true } : {}),
    ...(queryOptions.useInvalidate ? { useInvalidate: true } : {}),
    ...(queryOptions.useSetQueryData ? { useSetQueryData: true } : {}),
    ...(queryOptions.useGetQueryData ? { useGetQueryData: true } : {}),
    // Preserve explicit `false` so the toggles aren't silent no-ops (#2376).
    ...(queryOptions.useQuery === undefined
      ? {}
      : { useQuery: queryOptions.useQuery }),
    ...(queryOptions.useMutation === undefined
      ? {}
      : { useMutation: queryOptions.useMutation }),
    ...(queryOptions.useSuspenseQuery ? { useSuspenseQuery: true } : {}),
    ...(queryOptions.useSuspenseInfiniteQuery
      ? { useSuspenseInfiniteQuery: true }
      : {}),
    ...(queryOptions.useInfinite ? { useInfinite: true } : {}),
    ...(queryOptions.useInfiniteQueryParam
      ? { useInfiniteQueryParam: queryOptions.useInfiniteQueryParam }
      : {}),
    ...(queryOptions.options ? { options: queryOptions.options } : {}),
    ...(queryOptions.queryKey
      ? {
          queryKey: normalizeMutator(outputWorkspace, queryOptions.queryKey),
        }
      : {}),
    ...(queryOptions.queryOptions
      ? {
          queryOptions: normalizeMutator(
            outputWorkspace,
            queryOptions.queryOptions,
          ),
        }
      : {}),
    ...(queryOptions.mutationOptions
      ? {
          mutationOptions: normalizeMutator(
            outputWorkspace,
            queryOptions.mutationOptions,
          ),
        }
      : {}),
    ...(queryOptions.signal ? { signal: true } : {}),
    ...(queryOptions.shouldExportMutatorHooks
      ? { shouldExportMutatorHooks: true }
      : {}),
    // `shouldExportQueryKey` is the deprecated alias of `shouldExportKeys`.
    ...((queryOptions.shouldExportKeys ?? queryOptions.shouldExportQueryKey)
      ? { shouldExportKeys: true }
      : {}),
    ...(queryOptions.shouldFilterQueryKey
      ? { shouldFilterQueryKey: true }
      : {}),
    ...(queryOptions.queryKeyFilter
      ? { queryKeyFilter: queryOptions.queryKeyFilter }
      : {}),
    ...(queryOptions.shouldExportHttpClient
      ? { shouldExportHttpClient: true }
      : {}),
    ...(queryOptions.shouldSplitQueryKey ? { shouldSplitQueryKey: true } : {}),
    ...(queryOptions.useOperationIdAsQueryKey
      ? { useOperationIdAsQueryKey: true }
      : {}),
  };
};

// Temporary duplicate code before next major release
const normalizeMutator = (
  workspace: string,
  mutator?: Mutator,
): NormalizedMutator | undefined => {
  if (isObject(mutator)) {
    const m = mutator as Exclude<Mutator, string>;
    if (!m.path) {
      throw new Error(styleText('red', `Mutator need a path`));
    }

    return {
      path: nodePath.resolve(workspace, m.path),
      name: m.name,
      default: m.default ?? !m.name,
      alias: m.alias,
      external: m.external,
      extension: m.extension,
      useHooks: m.useHooks,
    };
  }

  if (isString(mutator)) {
    return {
      path: nodePath.resolve(workspace, mutator),
      default: true,
    };
  }

  return undefined;
};

export const shouldUseOptionsHook = ({
  optionsMutator,
  queryKeyMutator,
  mutator,
}: {
  optionsMutator?: GeneratorMutator;
  queryKeyMutator?: GeneratorMutator;
  mutator?: GeneratorMutator;
}): boolean => {
  if (optionsMutator) {
    return optionsMutator.useHooks ?? true;
  }

  return !!queryKeyMutator || !!mutator?.isHook;
};

export const getQueryTypeForFramework = (type: string): string => {
  // Angular, Svelte and Solid Query don't have suspense variants, map them to regular queries
  switch (type) {
    case 'suspenseQuery': {
      return 'query';
    }
    case 'suspenseInfiniteQuery': {
      return 'infiniteQuery';
    }
    default: {
      return type;
    }
  }
};

export const getHasSignal = ({
  overrideQuerySignal = false,
}: {
  overrideQuerySignal?: boolean;
}) => overrideQuerySignal;

/**
 * Builds the `operationId`/`operationName` pair passed as the third argument
 * to a `queryOptions`/`mutationOptions` mutator.
 *
 * Both land in single-quoted literals inside an object that the generated hook
 * evaluates at call time. `operationName` is already run through `sanitize`
 * upstream, but `operationId` is the raw value from the OpenAPI document and
 * nothing sanitizes it, so a quote in the spec would otherwise close the
 * literal and inject entries — and expressions — into that object.
 */
export const getOperationMetaLiteral = (
  operationId: string,
  operationName: string,
): string =>
  `operationId: '${jsStringLiteralEscape(operationId)}', operationName: '${jsStringLiteralEscape(operationName)}'`;
