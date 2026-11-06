import {
  type GetterProps,
  GetterPropType,
  OutputClient,
  pascal,
  toObjectString,
} from '@orval/core';

import type {
  FrameworkAdapterConfig,
  MutationHookBodyContext,
  MutationReturnTypeContext,
  QueryInitContext,
  QueryInvocationContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { isInfiniteQuery } from '../query-options';
import { escapeRegExpMetaChars, getQueryTypeForFramework } from '../utils';

// `initialData` is excluded from the accepted options because an
// optional-but-present `initialData` matches neither the `{ initialData: T }`
// nor the `{ initialData?: undefined }` overload of `useQuery`. That is the same
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

/**
 * Names of the helpers emitted in the file header (see `SOLID_ACCESSOR_HELPER`
 * in `../index.ts`) when a hook takes accessor parameters.
 */
export const SOLID_MAYBE_ACCESSOR = 'MaybeAccessor';
export const SOLID_RESOLVE_ACCESSOR = 'resolveAccessor';

/**
 * Widens one hook parameter to `MaybeAccessor<T>`, so callers can pass a
 * signal (or any `() => T`) and the query re-runs when it changes (#3195).
 *
 * A default value stays outside the wrapper (`version: MaybeAccessor<number>
 * = 1`); the optional marker is kept. Named path params are typed by their
 * object type and passed through un-destructured, because the options factory
 * destructures (and applies defaults) once the accessor is resolved.
 */
const wrapPropWithMaybeAccessor = (
  prop: GetterProps[number],
  field: 'definition' | 'implementation',
): string => {
  if (prop.type === GetterPropType.NAMED_PATH_PARAMS) {
    // When every path param has a default, the object itself defaults to `{}`.
    const objectDefault =
      field === 'implementation' && prop.implementation.endsWith(' = {}')
        ? ' = {}'
        : '';
    return `${prop.name}: ${SOLID_MAYBE_ACCESSOR}<${prop.schema.name}>${objectDefault}`;
  }

  const value = prop[field];
  const match = new RegExp(
    String.raw`^(${escapeRegExpMetaChars(prop.name)}\??)\s*:\s*([\s\S]+)$`,
  ).exec(value);
  if (!match) return value;

  const [, name, rest] = match;
  // `=` that is not part of an arrow (`=>`) starts the default value.
  const defaultMatch = /^([\s\S]*?)\s*=(?!>)\s*([\s\S]+)$/.exec(rest);
  const [type, defaultValue] = defaultMatch
    ? [defaultMatch[1], defaultMatch[2]]
    : [rest, undefined];

  // A prop widened to `undefined | T` (see `widenOptionalPropsToUndefined`)
  // keeps the `undefined` outside the wrapper. `MaybeAccessor<undefined | T>`
  // would also admit an accessor returning `undefined`, which the
  // implementation's `MaybeAccessor<T> = default` does not, so the overloads
  // would stop matching it (TS2394).
  const widened = /^undefined\s*\|\s*([\s\S]+)$/.exec(type.trim());
  const innerType = widened ? widened[1] : type.trim();

  return `${name}: ${SOLID_MAYBE_ACCESSOR}<${innerType}>${
    widened ? ' | undefined' : ''
  }${defaultValue === undefined ? '' : ` = ${defaultValue}`}`;
};

export const createSolidAdapter = ({
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
  hasQueryV5WithMutationContextOnSuccess,
  hasQueryV5WithOptionalOnMutateResult,
  hasQueryV5WithRequiredContextOnSuccess,
  hasQueryV5WithQueryMethod,
  hasSolidQueryUsePrefix,
  hasSolidQueryRenamedOptionsTypes,
}: {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  hasQueryV5WithMutationContextOnSuccess: boolean;
  hasQueryV5WithOptionalOnMutateResult: boolean;
  hasQueryV5WithRequiredContextOnSuccess: boolean;
  hasQueryV5WithQueryMethod: boolean;
  hasSolidQueryUsePrefix: boolean;
  hasSolidQueryRenamedOptionsTypes: boolean;
}): FrameworkAdapterConfig => ({
  outputClient: OutputClient.SOLID_QUERY,
  hookPrefix: hasSolidQueryUsePrefix ? 'use' : 'create',
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
  hasQueryV5WithMutationContextOnSuccess,
  hasQueryV5WithOptionalOnMutateResult,
  hasQueryV5WithRequiredContextOnSuccess,
  hasQueryV5WithQueryMethod,

  getQueryOptionsDefinitionPrefix(): string {
    return hasSolidQueryUsePrefix ? 'Use' : 'Create';
  },

  getHookPropsDefinitions(
    props: GetterProps,
    field: 'definition' | 'implementation' = 'implementation',
  ): string {
    // Only the hook takes accessors. The query key, the options factory and
    // every helper keep plain parameters: a key holding a function would never
    // be stable, so values are resolved once, inside the tracked thunk.
    return toObjectString(
      props.map((prop) => wrapPropWithMaybeAccessor(prop, field)),
    );
  },

  wrapHookQueryOptionsType(optionsType: string): string {
    return `${SOLID_MAYBE_ACCESSOR}<${optionsType.trim()}>`;
  },

  generateQueryInit({
    props,
    queryOptionsFnName,
    queryOptionsVarName,
    isRequestOptions,
  }: QueryInitContext): string {
    // One thunk serves both `useQuery` and the returned `queryKey` getter.
    // Resolving the accessors inside it is what lets Solid track them: the
    // component body runs once, so a value read outside would be frozen.
    const args = [
      ...props.map((prop) => `${SOLID_RESOLVE_ACCESSOR}(${prop.name})`),
      `${SOLID_RESOLVE_ACCESSOR}(${isRequestOptions ? 'options' : 'queryOptions'})`,
    ].join(', ');
    return `const ${queryOptionsVarName} = () => ${queryOptionsFnName}(${args});`;
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

    if (isInfiniteQuery(type)) {
      return INFINITE_QUERY_OPTIONS_CONSTRAINT;
    }

    // Excluding `initialData` is only safe when the overload signatures can add
    // it back, which needs the `Defined*Result` types. See
    // shouldGenerateOverrideTypes below.
    return hasSolidQueryUsePrefix ? QUERY_OPTIONS_CONSTRAINT : undefined;
  },

  getQueryType(type: string): string {
    // Solid Query ships no suspense hooks, so a suspense config would otherwise
    // emit `useSuspenseQuery` / `useSuspenseInfiniteQuery`, which do not exist.
    return getQueryTypeForFramework(type);
  },

  shouldGenerateOverrideTypes(): boolean {
    // The overloads are what let `options.query` use the plain interface: they,
    // not the `Accessor` alias, carry the `initialData` discrimination.
    //
    // They name `DefinedUseQueryResult` and `DefinedUseInfiniteQueryResult`,
    // which arrived with the `use` prefix in 5.71.5. `@tanstack/solid-query`
    // 5.0.0 exports `DefinedCreateQueryResult` but no infinite counterpart, so
    // earlier versions keep the previous output rather than referencing a type
    // that does not exist.
    return hasQueryV5 && hasSolidQueryUsePrefix;
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
    //
    // `queryKey` is a getter over the options thunk, so it follows the current
    // parameters and tracks when read inside a reactive scope (#3195).
    return `return mergeProps(${queryResultVarName}, { get queryKey() { return ${queryOptionsVarName}().queryKey; } }) as any;`;
  },

  generateQueryInvocationArgs({
    queryOptionsVarName,
    optionalQueryClientArgument,
  }: QueryInvocationContext): string {
    // Solid Query takes the options as an accessor; the thunk from
    // `generateQueryInit` is one.
    return `${queryOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''}`;
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
