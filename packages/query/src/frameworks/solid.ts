import { OutputClient, pascal } from '@orval/core';

import type {
  FrameworkAdapterConfig,
  MutationHookBodyContext,
  MutationReturnTypeContext,
  QueryInvocationContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { isInfiniteQuery } from '../query-options';
import { getQueryTypeForFramework } from '../utils';

// `initialData` is excluded from the accepted options because an
// optional-but-present `initialData` matches neither the `{ initialData: … }`
// nor the `{ initialData?: undefined }` overload of `useQuery` — the same
// discrimination loss that turning off `shouldCastQueryOptions()` exists to
// avoid. The overload signatures add it back with the exact type each one needs.
// See packages/query/DEVELOPMENT.md.
const QUERY_OPTIONS_CONSTRAINT = {
  exclude: ['initialData'],
} as const;

const INFINITE_QUERY_OPTIONS_CONSTRAINT = {
  require: ['initialPageParam', 'getNextPageParam'],
  exclude: ['initialData'],
} as const;

export const createSolidAdapter = ({
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
  hasQueryV5WithMutationContextOnSuccess,
  hasQueryV5WithRequiredContextOnSuccess,
  hasSolidQueryUsePrefix,
  hasSolidQueryRenamedOptionsTypes,
}: {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  hasQueryV5WithMutationContextOnSuccess: boolean;
  hasQueryV5WithRequiredContextOnSuccess: boolean;
  hasSolidQueryUsePrefix: boolean;
  hasSolidQueryRenamedOptionsTypes: boolean;
}): FrameworkAdapterConfig => ({
  outputClient: OutputClient.SOLID_QUERY,
  hookPrefix: hasSolidQueryUsePrefix ? 'use' : 'create',
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
  hasQueryV5WithMutationContextOnSuccess,
  hasQueryV5WithRequiredContextOnSuccess,

  getQueryOptionsDefinitionPrefix(): string {
    return hasSolidQueryUsePrefix ? 'Use' : 'Create';
  },

  getOptionsReturnTypeName(
    type: 'query' | 'infiniteQuery' | 'mutation',
  ): string | undefined {
    // Solid Query exposes plain (non-Accessor) options interfaces. The
    // Accessor-wrapped `Use*Options` / `Create*Options` variants cannot be
    // used here because the generated code passes options as a plain object
    // (`{ ...options.mutation }`) before the call site wraps the whole result
    // in an accessor (`useMutation(() => mutationOptions(...))`).
    //
    // v5.100.6 renamed these interfaces to drop the `Solid` prefix.
    if (type === 'mutation') {
      return hasSolidQueryRenamedOptionsTypes
        ? 'MutationOptions'
        : 'SolidMutationOptions';
    }
    if (type === 'infiniteQuery') {
      return hasSolidQueryRenamedOptionsTypes
        ? 'InfiniteQueryOptions'
        : 'SolidInfiniteQueryOptions';
    }
    return hasSolidQueryRenamedOptionsTypes
      ? 'QueryOptions'
      : 'SolidQueryOptions';
  },

  getQueryKeyPrefix(): string {
    // Solid Query v5 doesn't support accessing queryKey from queryOptions
    // The queryKey must be generated directly from the params
    return '';
  },

  shouldAnnotateQueryKey(): boolean {
    // Solid Query works with accessor functions
    // The queryKey is accessed from within the accessor, not annotated on the return type
    return false;
  },

  shouldCastQueryResult(): boolean {
    // Solid Query should not cast the query result because it breaks TypeScript's
    // ability to discriminate between overloads based on initialData
    return false;
  },

  shouldCastQueryOptions(): boolean {
    // Solid Query should not cast the query options return type because it prevents
    // TypeScript from properly discriminating between defined and undefined initialData
    return false;
  },

  getUserQueryOptionsConstraint(type) {
    if (!hasQueryV5) {
      return undefined;
    }

    return isInfiniteQuery(type)
      ? INFINITE_QUERY_OPTIONS_CONSTRAINT
      : QUERY_OPTIONS_CONSTRAINT;
  },

  getQueryType(type: string): string {
    // Solid Query ships no suspense hooks, so a suspense config would otherwise
    // emit `useSuspenseQuery` / `useSuspenseInfiniteQuery`, which do not exist.
    return getQueryTypeForFramework(type);
  },

  shouldGenerateOverrideTypes(): boolean {
    // The overloads are what let `options.query` use the plain interface: they,
    // not the `Accessor` alias, carry the `initialData` discrimination.
    return hasQueryV5;
  },

  getInitialDataOptionsType({
    initialData,
    isInfinite,
    funcReturnType,
    infiniteTypeArgs,
  }): string {
    const name = `${pascal(initialData)}InitialData${
      isInfinite ? 'Infinite' : ''
    }Options`;

    // `ReturnType` unwraps the `Accessor<…>`; picking a property straight off the
    // alias yields `{}`. Solid Query's own `queryOptions()` unwraps the same way.
    return `ReturnType<${name}<${funcReturnType}, TError, TData${infiniteTypeArgs}>>`;
  },

  getQueryReturnType({
    type,
    isInitialDataDefined,
  }: QueryReturnTypeContext): string {
    const prefix = hasSolidQueryUsePrefix ? 'Use' : 'Create';
    const queryKeyType = hasQueryV5
      ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>`
      : 'QueryKey';
    const resultName = isInfiniteQuery(type)
      ? 'InfiniteQueryResult'
      : 'QueryResult';

    return `${isInitialDataDefined ? 'Defined' : ''}${prefix}${resultName}<TData, TError> & { queryKey: ${queryKeyType} }`;
  },

  getMutationReturnType({
    dataType,
    variableType,
  }: MutationReturnTypeContext): string {
    const prefix = hasSolidQueryUsePrefix ? 'Use' : 'Create';
    return `: ${prefix}MutationResult<
        Awaited<ReturnType<${dataType}>>,
        TError,
        ${variableType},
        TContext
      >`;
  },

  getQueryReturnStatement({
    queryResultVarName,
    queryOptionsVarName,
  }: QueryReturnStatementContext): string {
    // Attach queryKey without mutating the Solid Store. The query result is a
    // read-only store, so `Object.assign` hits its `set` trap: in dev it warns
    // "Cannot mutate a Store directly", and in every build the assignment is a
    // no-op (queryKey is never actually attached). `mergeProps` is Solid's
    // first-party way to compose a new accessor object via getters, so the
    // queryKey is exposed while the underlying store stays untouched and
    // reactive. The `as any` cast is required because mergeProps infers a
    // concrete result type that TS cannot prove assignable to the generic
    // `…Result<TData, TError>`; the caller-facing type comes from the hook's
    // explicit return-type annotation. See #3347.
    return `return mergeProps(${queryResultVarName}, { queryKey: ${queryOptionsVarName}.queryKey }) as any;`;
  },

  generateQueryInvocationArgs({
    queryOptionsFnName,
    queryProperties,
    isRequestOptions,
    optionalQueryClientArgument,
  }: QueryInvocationContext): string {
    // Solid Query requires options to be wrapped in an arrow function for reactivity
    const optionsArg = isRequestOptions ? 'options' : 'queryOptions';
    const args = queryProperties
      ? `${queryProperties},${optionsArg}`
      : optionsArg;
    return `() => ${queryOptionsFnName}(${args})${optionalQueryClientArgument ? ', queryClient' : ''}`;
  },

  generateMutationImplementation({
    mutationOptionsFnName,
    isRequestOptions,
  }): string {
    return `${mutationOptionsFnName}(${
      isRequestOptions ? 'options' : 'mutationOptions'
    })`;
  },

  supportsMutationInvalidation(): boolean {
    // Solid is NOT in the list of frameworks supporting mutation invalidation
    return false;
  },

  generateMutationOnSuccess(): string {
    return '';
  },

  generateMutationHookBody({
    operationPrefix,
    mutationImplementation,
    optionalQueryClientArgument,
  }: MutationHookBodyContext): string {
    // Solid Query mutations also need to be wrapped in accessor functions
    return `      return ${operationPrefix}Mutation(() => ${mutationImplementation}${optionalQueryClientArgument ? `, queryClient` : ''});`;
  },

  getOptionalQueryClientArgument(): string {
    // Solid Query expects queryClient to be an Accessor: () => QueryClient
    return ', queryClient?: () => QueryClient';
  },
});
