import type {
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
  GetterParams,
  GetterProp,
  GetterProps,
  GetterQueryParam,
  InvalidateTargetParam,
  OutputClient,
  OutputHttpClient,
} from '@orval/core';

import type { QueryType } from './query-options';

// --- Context types for adapter methods ---

export interface QueryReturnTypeContext {
  type: (typeof QueryType)[keyof typeof QueryType];
  isMutatorHook?: boolean;
  operationName: string;
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  isInitialDataDefined?: boolean;
}

export interface MutationReturnTypeContext {
  dataType: string;
  variableType: string;
}

export interface QueryReturnStatementContext {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  queryResultVarName: string;
  queryOptionsVarName: string;
}

export interface QueryInitContext {
  queryOptionsFnName: string;
  queryProperties: string;
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
}

export interface QueryInvocationContext {
  props: GetterProps;
  queryOptionsFnName: string;
  queryProperties: string;
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
  operationPrefix: string;
  type: (typeof QueryType)[keyof typeof QueryType];
  queryOptionsVarName: string;
  optionalQueryClientArgument: string;
}

interface InvalidateTarget {
  query: string;
  params?: InvalidateTargetParam[] | Record<string, InvalidateTargetParam>;
  invalidateMode: 'invalidate' | 'reset';
}

export interface MutationOnSuccessContext {
  operationName: string;
  definitions: string;
  isRequestOptions: boolean;
  generateInvalidateCall: (target: InvalidateTarget) => string;
  uniqueInvalidates: InvalidateTarget[];
}

export interface MutationHookBodyContext {
  operationPrefix: string;
  mutationOptionsFnName: string;
  mutationImplementation: string;
  mutationOptionsVarName: string;
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
  hasInvalidation: boolean;
  optionalQueryClientArgument: string;
}

/**
 * FrameworkAdapter encapsulates all framework-specific behavior for the query generator.
 * Each framework (React, Vue, Angular, Svelte, Solid) implements this interface.
 * The shared generators call adapter methods instead of using if/else branches.
 */
export interface FrameworkAdapter {
  // --- Identity ---
  readonly outputClient: OutputClient;
  /** 'use' | 'inject' | 'create' */
  readonly hookPrefix: string;
  /** Whether the Angular HttpClient is used (Angular adapter only) */
  readonly isAngularHttp: boolean;

  // --- Feature Flags (resolved from packageJson + config) ---
  readonly hasQueryV5: boolean;
  readonly hasQueryV5WithDataTagError: boolean;
  readonly hasQueryV5WithInfiniteQueryOptionsError: boolean;
  readonly hasQueryV5WithMutationContextOnSuccess: boolean;
  readonly hasQueryV5WithRequiredContextOnSuccess: boolean;

  // --- Props Transformation ---
  /** Vue: wraps with MaybeRef. Others: identity. */
  transformProps(props: GetterProps): GetterProps;

  /**
   * Get prop definitions for the hook function signature.
   * Angular: getter types (T | (() => T)). Svelte v6: accessor () => types. Others: standard.
   */
  getHookPropsDefinitions(props: GetterProps): string;

  // --- Named Path Params ---
  /** Whether named path params should be destructured (true for all except Vue) */
  shouldDestructureNamedPathParams(): boolean;

  // --- HTTP Function Props ---
  /** Transform query properties for the HTTP function call (Vue: unref, Angular: prefix http) */
  getHttpFunctionQueryProps(
    queryProperties: string,
    httpClient: OutputHttpClient,
    hasMutator: boolean,
  ): string;

  /** Build HTTP function props for infinite queries with pageParam substitution */
  getInfiniteQueryHttpProps(
    props: GetterProps,
    queryParam: string,
    httpClient: OutputHttpClient,
    hasMutator: boolean,
  ): string;

  /** Angular: 'http: HttpClient, ' when isAngularHttp && (!mutator || mutator.hasSecondArg). Others: '' */
  getHttpFirstParam(mutator?: GeneratorMutator): string;

  /** Angular: 'http, ' when isAngularHttp && !mutator. Others: '' */
  getMutationHttpPrefix(mutator?: GeneratorMutator): string;

  // --- Return Types ---
  getQueryReturnType(context: QueryReturnTypeContext): string;
  getMutationReturnType(context: MutationReturnTypeContext): string;
  getQueryReturnStatement(context: QueryReturnStatementContext): string;

  // --- Query Key ---
  /** Vue: uses getRouteAsArray for reactivity. Others: template literal string. */
  getQueryKeyRouteString(route: string, shouldSplitQueryKey: boolean): string;

  /** Vue/Angular: skip DataTag annotation on queryKey. Others: include it. */
  shouldAnnotateQueryKey(): boolean;

  /** Vue: unref all params at the top of the HTTP request fn. Others: empty string. */
  getRequestUnrefStatements(props: GetterProps): string;

  /**
   * Vue: unref named path params inside queryOptionsFn (other params stay
   * reactive for the query key). Others: empty string.
   */
  getQueryOptionsUnrefStatements(props: GetterProps): string;

  // --- Query Hook Generation ---
  /** Angular: inject(HttpClient). Svelte v6: empty. Others: queryOptions = fn(...). */
  generateQueryInit(context: QueryInitContext): string;

  /**
   * Generate the arguments passed to the query hook invocation.
   * Angular: () => { resolve getters; return options(http, ...); }
   * Svelte v6: () => optionsFn(prop1(), prop2(), options?.())
   * Others: queryOptions, queryClient
   */
  generateQueryInvocationArgs(context: QueryInvocationContext): string;

  /**
   * Suffix appended after the hook invocation for svelte v6.
   * Svelte v6: `, queryClient`. Others: empty string.
   */
  getQueryInvocationSuffix(): string;

  /** React v5 only: true to emit overload type declarations. */
  shouldGenerateOverrideTypes(): boolean;

  /** Whether to cast the query result with 'as returnType'. Solid Query needs this to be false for proper type inference. */
  shouldCastQueryResult?(): boolean;

  /** Whether to cast the query options return type. Solid Query needs this to be false for proper initialData discrimination. */
  shouldCastQueryOptions?(): boolean;

  /**
   * Constrain the user-facing `options.query` type for a query type.
   *
   * `require` keys become mandatory on `options.query`, which also makes
   * `options` itself mandatory. Because the generated options literal ends with
   * `...queryOptions`, requiring a key there is what makes the literal satisfy
   * the framework's options interface without an `as` cast. `exclude` keys are
   * dropped from the accepted type. Returning undefined keeps the default
   * parameter.
   *
   * Returning a constraint with only `exclude` is meaningful: it renders the
   * parameter from the plain interface and drops those keys, without making
   * `options` mandatory.
   *
   * Only honoured together with `getOptionsReturnTypeName()`, which supplies the
   * plain options interface these keys are read off; an adapter that implements
   * one without the other is ignored rather than emitting a parameter that
   * demands nothing. See packages/query/DEVELOPMENT.md.
   */
  getUserQueryOptionsConstraint?(
    type: (typeof QueryType)[keyof typeof QueryType],
  ): { require?: readonly string[]; exclude?: readonly string[] } | undefined;

  /**
   * The applied type that `initialData` is picked off for the overload
   * signatures. Defaults to `${pascal(initialData)}InitialDataOptions<…>`, which
   * is the plain object shape in most target libraries.
   *
   * Solid Query overrides this because its aliases are `Accessor<…>` function
   * types — picking a property off one yields `{}` — and because its infinite
   * queries need the `…InitialDataInfiniteOptions` variant, whose `initialData`
   * is an `InfiniteData<…>` rather than a bare page.
   */
  getInitialDataOptionsType?(context: {
    initialData: 'defined' | 'undefined';
    isInfinite: boolean;
    funcReturnType: string;
    infiniteTypeArgs: string;
  }): string;

  /** queryClient?: QueryClient vs queryClient?: () => QueryClient vs '' */
  getOptionalQueryClientArgument(hasInvalidation?: boolean): string;

  // --- Query Options ---
  /** 'Use' or 'Create' prefix for options definition types */
  getQueryOptionsDefinitionPrefix(): string;

  /**
   * Get the plain (non-Accessor) options interface name for this framework.
   *
   * Used as:
   *   - the helper function's return type for queries, infinite queries, and
   *     mutations (`isReturnType: true`), AND
   *   - the user-facing `options.mutation` parameter type
   *     (`isReturnType: false`, mutation only — issue #3365).
   *
   * Queries intentionally keep the prefix-based `Use*Options` / `Create*Options`
   * for the user-facing param: in Solid Query that aliases an `Accessor<…>`,
   * which is the shape `useQuery`'s `Undefined/DefinedInitialDataOptions`
   * overloads accept, preserving the `initialData?` discrimination at the call
   * site.
   *
   * Solid Query overrides this with `SolidQueryOptions` / `SolidMutationOptions`
   * (pre-v5.100.6) or `QueryOptions` / `MutationOptions` (v5.100.6+).
   *
   * Other adapters can leave this undefined and fall back to the prefix-based
   * default (`UseMutationOptions`, `CreateMutationOptions`, …), which IS the
   * plain options shape in their target libraries.
   */
  getOptionsReturnTypeName?(
    type: 'query' | 'infiniteQuery' | 'mutation',
  ): string | undefined;

  /** Vue: computed() for enabled. Others: direct boolean. */
  generateEnabledOption(
    params: GetterParams,
    options?: object | boolean,
  ): string;

  /** Vue: prepend `queryOptions?.queryKey ??`. Others: '' (for v4+ only). */
  getQueryKeyPrefix(): string;

  /**
   * Generate the query arguments string (options parameter).
   * Angular: options | (() => options). Svelte v6: () => options. Others: plain options.
   */
  generateQueryArguments(args: {
    operationName: string;
    definitions: string;
    mutator?: GeneratorMutator;
    isRequestOptions: boolean;
    type?: (typeof QueryType)[keyof typeof QueryType];
    queryParams?: GetterQueryParam;
    queryParam?: string;
    initialData?: 'defined' | 'undefined';
    httpClient: OutputHttpClient;
    forQueryOptions?: boolean;
    hasInvalidation?: boolean;
    useRuntimeFetcher?: boolean;
    /** `override.query.options` — the keys already written into the literal. */
    options?: object | boolean;
  }): string;

  // --- Mutation Hook Generation ---
  /** Generate the mutationOptionsFnName(...) call string for mutation hook body */
  generateMutationImplementation(context: {
    mutationOptionsFnName: string;
    hasInvalidation: boolean;
    isRequestOptions: boolean;
  }): string;

  /** Whether this framework supports mutation invalidation */
  supportsMutationInvalidation(): boolean;

  /** Framework-specific onSuccess callback signature for mutation invalidation */
  generateMutationOnSuccess(context: MutationOnSuccessContext): string;

  /**
   * Generate the mutation hook body.
   * Angular: inject(HttpClient) + inject(QueryClient) + injectMutation(() => ...)
   * Others: useQueryClient() + useMutation(...)
   */
  generateMutationHookBody(context: MutationHookBodyContext): string;

  // --- Query Type Mapping ---
  /** Angular/Svelte: map suspense types to non-suspense. React/Vue/Solid: identity. */
  getQueryType(type: (typeof QueryType)[keyof typeof QueryType]): string;

  // --- HTTP Request Function ---
  /** Generate the HTTP request function for this framework */
  generateRequestFunction(
    verbOptions: GeneratorVerbOptions,
    options: GeneratorOptions,
  ): string;

  /**
   * Wrap a hook-mutator request callback for the HTTP request function.
   * React/Solid/Svelte: memoize with `useCallback`. Vue: return the callback unchanged.
   */
  wrapHookMutatorCallback(callback: string, operationName: string): string;

  /** Map a prop to its representation in query properties (e.g., destructured for named path params or name) */
  getQueryPropertyForProp(
    prop: GetterProp,
    body: { implementation: string },
  ): string;

  // --- Prefetch Generation ---
  /**
   * Generate the prefetch function for a query.
   * Implementations receive a PrefetchContext and return source for an
   * exported helper. The helper should accept the framework's QueryClient
   * (and HttpClient when the framework requires it) as parameters rather
   * than resolving them internally via DI/hooks.
   * React: useQueryClient + useCallback (hook mutator) or plain async (non-hook).
   * Angular: plain async function accepting QueryClient and HttpClient when needed.
   * Default: React-style (backward compatible).
   */
  generatePrefetch?(context: PrefetchContext): string;
}

export interface PrefetchContext {
  operationName: string;
  mutator?: GeneratorMutator;
  type: (typeof QueryType)[keyof typeof QueryType];
  usePrefetch?: boolean;
  useQuery?: boolean;
  useInfinite?: boolean;
  doc?: string;
  queryProps: string;
  dataType: string;
  errorType: string;
  queryArguments: string;
  queryOptionsVarName: string;
  queryOptionsFnName: string;
  queryProperties: string;
  isRequestOptions: boolean;
}

/** Fields that have factory defaults in withDefaults(), so adapters only override what differs. */
type DefaultableFields =
  | 'isAngularHttp'
  | 'getHttpFirstParam'
  | 'getMutationHttpPrefix'
  | 'getRequestUnrefStatements'
  | 'getQueryOptionsUnrefStatements'
  | 'wrapHookMutatorCallback'
  | 'generateRequestFunction'
  | 'getQueryInvocationSuffix'
  | 'transformProps'
  | 'shouldDestructureNamedPathParams'
  | 'shouldAnnotateQueryKey'
  | 'shouldGenerateOverrideTypes'
  | 'shouldCastQueryResult'
  | 'shouldCastQueryOptions'
  | 'getHttpFunctionQueryProps'
  | 'getQueryType'
  | 'getQueryKeyPrefix'
  | 'getQueryOptionsDefinitionPrefix'
  | 'getHookPropsDefinitions'
  | 'getQueryKeyRouteString'
  | 'generateEnabledOption'
  | 'getQueryPropertyForProp'
  | 'getInfiniteQueryHttpProps'
  | 'generateQueryInit'
  | 'generateQueryInvocationArgs'
  | 'getOptionalQueryClientArgument'
  | 'generateQueryArguments'
  | 'generateMutationOnSuccess';

/**
 * Adapter config type — adapters implement this. The factory fills in
 * defaults for DefaultableFields, so adapters only override what they need.
 */
export type FrameworkAdapterConfig = Omit<FrameworkAdapter, DefaultableFields> &
  Partial<Pick<FrameworkAdapter, DefaultableFields>>;
