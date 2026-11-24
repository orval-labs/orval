import type {
  Mutator,
  NormalizedMutator,
  NormalizedRuntimeValidation,
  RuntimeValidation,
} from '@orval/core';

/**
 * A single parameter value for `mutationInvalidates` params.
 *
 * - `string` – treated as a variable reference, e.g. `"petId"` → `variables.petId`
 * - `{ literal: string }` – emitted as a string literal, e.g. `{ literal: "@me" }` → `"@me"`
 */
export type InvalidateTargetParam = string | { literal: string };

export type InvalidateTarget =
  | string
  | {
      query: string;
      params?: InvalidateTargetParam[] | Record<string, InvalidateTargetParam>;
      invalidateMode?: 'invalidate' | 'reset';
      file?: string;
    };

export interface MutationInvalidatesRule {
  onMutations: string[];
  invalidates: InvalidateTarget[];
}

export type MutationInvalidatesConfig = MutationInvalidatesRule[];

export type InfiniteQueryParamLocation = 'query' | 'body';

export interface QueryDocsOptions {
  /**
   * Add an `@route METHOD /path` line to the JSDoc of generated hooks.
   *
   * @default false
   */
  route?: boolean;
}

export interface NormalizedQueryOptions {
  useQuery?: boolean;
  useSuspenseQuery?: boolean;
  useMutation?: boolean;
  useInfinite?: boolean;
  useSuspenseInfiniteQuery?: boolean;
  useInfiniteQueryParam?: string | string[];
  /**
   * Where the `useInfiniteQueryParam` page param lives. `'query'` pages
   * through a URL query parameter; `'body'` pages through a property of the
   * JSON request body, for `POST` endpoints that paginate with a filter body.
   *
   * @default 'query'
   */
  useInfiniteQueryParamLocation?: InfiniteQueryParamLocation;
  usePrefetch?: boolean;
  useInvalidate?: boolean;
  useSetQueryData?: boolean;
  useGetQueryData?: boolean;
  /**
   * Hold a query whose params are not resolved yet with `skipToken` instead of
   * the generated `enabled` guard, so a caller's own `enabled` cannot replace
   * the check and `refetch()` cannot bypass it. TanStack Query v5 only.
   */
  useSkipToken?: boolean;
  /**
   * Extra JSDoc emitted on generated query and mutation hooks.
   */
  docs?: QueryDocsOptions;

  options?: Record<string, unknown>;
  queryKey?: NormalizedMutator;
  queryOptions?: NormalizedMutator;
  mutationOptions?: NormalizedMutator;
  shouldExportMutatorHooks?: boolean;
  shouldExportHttpClient?: boolean;
  shouldExportKeys?: boolean;
  shouldFilterQueryKey?: boolean;
  queryKeyFilter?: string;
  shouldSplitQueryKey?: boolean;
  useOperationIdAsQueryKey?: boolean;
  signal?: boolean;
  version?: 3 | 4 | 5;
  mutationInvalidates?: MutationInvalidatesConfig;
  runtimeValidation?: NormalizedRuntimeValidation;
}

export interface QueryOptions {
  useQuery?: boolean;
  useSuspenseQuery?: boolean;
  useMutation?: boolean;
  useInfinite?: boolean;
  useSuspenseInfiniteQuery?: boolean;
  useInfiniteQueryParam?: string | string[];
  /**
   * Where the `useInfiniteQueryParam` page param lives. `'query'` pages
   * through a URL query parameter; `'body'` pages through a property of the
   * JSON request body, for `POST` endpoints that paginate with a filter body.
   *
   * @default 'query'
   */
  useInfiniteQueryParamLocation?: InfiniteQueryParamLocation;
  usePrefetch?: boolean;
  useInvalidate?: boolean;
  useSetQueryData?: boolean;
  useGetQueryData?: boolean;
  /**
   * Hold a query whose params are not resolved yet with `skipToken` instead of
   * the generated `enabled` guard, so a caller's own `enabled` cannot replace
   * the check and `refetch()` cannot bypass it. TanStack Query v5 only.
   */
  useSkipToken?: boolean;
  /**
   * Extra JSDoc emitted on generated query and mutation hooks.
   */
  docs?: QueryDocsOptions;

  options?: Record<string, unknown>;
  queryKey?: Mutator;
  queryOptions?: Mutator;
  mutationOptions?: Mutator;
  shouldExportMutatorHooks?: boolean;
  shouldExportHttpClient?: boolean;
  shouldExportKeys?: boolean;
  /**
   * @deprecated Renamed to `shouldExportKeys`, since it now also exports mutation keys
   */
  shouldExportQueryKey?: boolean;
  shouldFilterQueryKey?: boolean;
  queryKeyFilter?: string;
  shouldSplitQueryKey?: boolean;
  useOperationIdAsQueryKey?: boolean;
  signal?: boolean;
  version?: 3 | 4 | 5;
  mutationInvalidates?: MutationInvalidatesConfig;
  runtimeValidation?: RuntimeValidation;
}
