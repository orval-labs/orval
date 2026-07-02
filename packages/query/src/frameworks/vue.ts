import {
  getRouteAsArray,
  type GetterParams,
  type GetterProp,
  type GetterProps,
  GetterPropType,
  isObject,
  OutputClient,
  OutputHttpClient,
  pascal,
} from '@orval/core';

import type {
  FrameworkAdapterConfig,
  MutationHookBodyContext,
  MutationOnSuccessContext,
  MutationReturnTypeContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { QueryType } from '../query-options';

/**
 * Vue Query v5 requires Vue 3.3+, where `MaybeRefOrGetter<T>` (a superset of
 * `MaybeRef<T>` that also accepts `() => T` getters) and `toValue()` exist.
 * The wrapper type and resolver must always move together: pairing
 * `MaybeRefOrGetter` with `unref` (which cannot resolve a getter) would
 * silently break reactive params.
 */
interface VueReactivity {
  wrapper: 'MaybeRef' | 'MaybeRefOrGetter';
  resolve: 'unref' | 'toValue';
}

const getVueReactivity = (hasQueryV5: boolean): VueReactivity =>
  hasQueryV5
    ? { wrapper: 'MaybeRefOrGetter', resolve: 'toValue' }
    : { wrapper: 'MaybeRef', resolve: 'unref' };

function vueWrapTypeWithMaybeRef(
  props: GetterProps,
  hasQueryV5: boolean,
): GetterProps {
  const { wrapper } = getVueReactivity(hasQueryV5);
  return props.map((prop) => {
    const [paramName, paramType] = prop.implementation.split(':');
    if (!paramType) return prop;
    const name =
      prop.type === GetterPropType.NAMED_PATH_PARAMS ? prop.name : paramName;

    const [type, defaultValue] = paramType.split('=');
    return {
      ...prop,
      implementation: `${name}: ${wrapper}<${type.trim()}>${
        defaultValue ? ` = ${defaultValue}` : ''
      }`,
    };
  });
}

const vueUnRefParams = (props: GetterProps, hasQueryV5: boolean): string => {
  const { resolve } = getVueReactivity(hasQueryV5);
  return props
    .map((prop) => {
      if (prop.type === GetterPropType.NAMED_PATH_PARAMS) {
        return `const ${prop.destructured} = ${resolve}(${prop.name});`;
      }
      return `${prop.name} = ${resolve}(${prop.name});`;
    })
    .join('\n');
};

export const createVueAdapter = ({
  hasVueQueryV4,
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
  hasQueryV5WithMutationContextOnSuccess,
  hasQueryV5WithRequiredContextOnSuccess,
}: {
  hasVueQueryV4: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  hasQueryV5WithMutationContextOnSuccess: boolean;
  hasQueryV5WithRequiredContextOnSuccess: boolean;
}): FrameworkAdapterConfig => ({
  outputClient: OutputClient.VUE_QUERY,
  hookPrefix: 'use',
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
  hasQueryV5WithMutationContextOnSuccess,
  hasQueryV5WithRequiredContextOnSuccess,

  transformProps(props: GetterProps): GetterProps {
    return vueWrapTypeWithMaybeRef(props, hasQueryV5);
  },

  shouldDestructureNamedPathParams(): boolean {
    // Vue keeps param.name for named path params (doesn't destructure)
    return false;
  },

  getHttpFunctionQueryProps(
    queryProperties: string,
    httpClient: OutputHttpClient,
  ): string {
    // Vue with fetch: resolve each prop (toValue on v5 to support getters)
    if (httpClient === OutputHttpClient.FETCH && queryProperties) {
      const { resolve } = getVueReactivity(hasQueryV5);
      return queryProperties
        .split(',')
        .map((prop) => `${resolve}(${prop})`)
        .join(',');
    }
    return queryProperties;
  },

  getInfiniteQueryHttpProps(
    props: GetterProps,
    queryParam: string,
    httpClient: OutputHttpClient,
  ): string {
    const { resolve } = getVueReactivity(hasQueryV5);
    return props
      .map((param) => {
        // Vue does NOT destructure named path params (keeps param.name)
        if (param.name === 'params') {
          return `{...${resolve}(params), '${queryParam}': pageParam ?? ${resolve}(params)?.['${queryParam}']}`;
        }

        // Fetch-style request functions accept plain values, but axios-style
        // accept MaybeRef(OrGetter)<T> so they unwrap the values internally.
        return httpClient === OutputHttpClient.FETCH
          ? `${resolve}(${param.name})`
          : param.name;
      })
      .join(',');
  },

  getQueryReturnType({ type }: QueryReturnTypeContext): string {
    if (!hasVueQueryV4) {
      return ` UseQueryReturnType<TData, TError, Use${pascal(
        type,
      )}Result<TData, TError>> & { queryKey: QueryKey }`;
    }

    if (type !== QueryType.INFINITE && type !== QueryType.SUSPENSE_INFINITE) {
      return `UseQueryReturnType<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
    }

    return `UseInfiniteQueryReturnType<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
  },

  getMutationReturnType({
    dataType,
    variableType,
  }: MutationReturnTypeContext): string {
    return `: UseMutationReturnType<
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
    const queryKeyType = hasQueryV5
      ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>`
      : 'QueryKey';
    // `unref`, not the v5 `resolve`: this runs on both v4 and v5, and the query
    // options object is a plain ref (never a getter), so `unref` is sufficient
    // and stays valid on Vue < 3.3 where `toValue` doesn't exist.
    return `${queryResultVarName}.queryKey = unref(${queryOptionsVarName}).queryKey as ${queryKeyType};

  return ${queryResultVarName};`;
  },

  getQueryKeyRouteString(route: string): string {
    // Vue always uses getRouteAsArray for reactivity
    return getRouteAsArray(route);
  },

  shouldAnnotateQueryKey(): boolean {
    // Vue skips DataTag annotation
    return false;
  },

  getRequestUnrefStatements(props: GetterProps): string {
    return vueUnRefParams(props, hasQueryV5);
  },

  getQueryOptionsUnrefStatements(props: GetterProps): string {
    return vueUnRefParams(
      props.filter((prop) => prop.type === GetterPropType.NAMED_PATH_PARAMS),
      hasQueryV5,
    );
  },

  wrapHookMutatorCallback(callback: string): string {
    // Vue does not wrap the hook mutator callback with useCallback.
    return callback;
  },

  generateEnabledOption(
    params: GetterParams,
    options?: object | boolean,
  ): string {
    if (params.length === 0) return '';
    if (!isObject(options) || !Object.hasOwn(options, 'enabled')) {
      const { resolve } = getVueReactivity(hasQueryV5);
      return `enabled: computed(() => ${params
        .map(
          ({ name }) =>
            `${resolve}(${name}) !== null && ${resolve}(${name}) !== undefined`,
        )
        .join(' && ')}),`;
    }
    return '';
  },

  getQueryKeyPrefix(): string {
    return hasVueQueryV4 ? '' : 'queryOptions?.queryKey ?? ';
  },

  generateMutationImplementation({
    mutationOptionsFnName,
    hasInvalidation,
    isRequestOptions,
  }): string {
    return `${mutationOptionsFnName}(${hasInvalidation ? `queryClient ?? backupQueryClient, ` : ''}${
      isRequestOptions ? 'options' : 'mutationOptions'
    })`;
  },

  supportsMutationInvalidation(): boolean {
    return hasQueryV5;
  },

  generateMutationOnSuccess({
    operationName,
    definitions,
    isRequestOptions,
    generateInvalidateCall,
    uniqueInvalidates,
  }: MutationOnSuccessContext): string {
    // The `unref` calls below resolve user-supplied mutation options (a ref,
    // never a getter), so `unref` is correct here and on Vue < 3.3 — unlike the
    // request params, these are not wrapped in `MaybeRefOrGetter`.
    const invalidateCalls = uniqueInvalidates
      .map((t) => generateInvalidateCall(t))
      .join('\n');
    if (hasQueryV5WithMutationContextOnSuccess) {
      if (isRequestOptions) {
        return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, onMutateResult: TContext, context: MutationFunctionContext) => {
        if (!options?.skipInvalidation) {
    ${invalidateCalls}
        }
        unref(unref(typeof mutationOptions === 'function' ? mutationOptions() : mutationOptions)?.onSuccess)?.(data, variables, onMutateResult, context);
      };`;
      }
      return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, onMutateResult: TContext, context: MutationFunctionContext) => {
    ${invalidateCalls}
        unref(unref(typeof mutationOptions === 'function' ? mutationOptions() : mutationOptions)?.onSuccess)?.(data, variables, onMutateResult, context);
      };`;
    }
    if (isRequestOptions) {
      return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, context: TContext${hasQueryV5WithRequiredContextOnSuccess ? '' : ' | undefined'}) => {
        if (!options?.skipInvalidation) {
    ${invalidateCalls}
        }
        unref(unref(typeof mutationOptions === 'function' ? mutationOptions() : mutationOptions)?.onSuccess)?.(data, variables, context);
      };`;
    }
    return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, context: TContext${hasQueryV5WithRequiredContextOnSuccess ? '' : ' | undefined'}) => {
    ${invalidateCalls}
        unref(unref(typeof mutationOptions === 'function' ? mutationOptions() : mutationOptions)?.onSuccess)?.(data, variables, context);
      };`;
  },

  generateMutationHookBody({
    operationPrefix,
    mutationImplementation,
    hasInvalidation,
    optionalQueryClientArgument,
  }: MutationHookBodyContext): string {
    return `      ${hasInvalidation ? `const backupQueryClient = useQueryClient();\n      ` : ''}return ${operationPrefix}Mutation(${mutationImplementation}${optionalQueryClientArgument ? `, queryClient` : ''});`;
  },

  getQueryPropertyForProp(
    prop: GetterProp,
    body: { implementation: string },
  ): string {
    // Vue does NOT destructure named path params (keeps param.name for reactivity)
    return prop.type === GetterPropType.BODY ? body.implementation : prop.name;
  },
});
