import type {
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
  GetterParams,
  GetterProp,
  GetterProps,
  OutputClient,
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

export interface MutationOnSuccessContext {
  operationName: string;
  definitions: string;
  generateInvalidateCall: (target: {
    query: string;
    params?: string[] | Record<string, string>;
  }) => string;
  uniqueInvalidates: {
    query: string;
    params?: string[] | Record<string, string>;
  }[];
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
    httpClient: import('@orval/core').OutputHttpClient,
    hasMutator: boolean,
  ): string;

  /** Build HTTP function props for infinite queries with pageParam substitution */
  getInfiniteQueryHttpProps(
    props: GetterProps,
    queryParam: string,
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

  /** Vue: unref named path params inside queryOptionsFn. Others: empty string. */
  getUnrefStatements(props: GetterProps): string;

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

  /** queryClient?: QueryClient vs queryClient?: () => QueryClient vs '' */
  getOptionalQueryClientArgument(hasInvalidation?: boolean): string;

  // --- Query Options ---
  /** 'Use' or 'Create' prefix for options definition types */
  getQueryOptionsDefinitionPrefix(): string;

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
    queryParams?: import('@orval/core').GetterQueryParam;
    queryParam?: string;
    initialData?: 'defined' | 'undefined';
    httpClient: OutputHttpClient;
    forQueryOptions?: boolean;
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

  /** Map a prop to its representation in query properties (e.g., destructured for named path params or name) */
  getQueryPropertyForProp(
    prop: import('@orval/core').GetterProp,
    body: { implementation: string },
  ): string;
}
