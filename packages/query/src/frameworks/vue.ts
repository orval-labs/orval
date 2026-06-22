import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
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
import { generateRequestFunction as generateFetchRequestFunction } from '@orval/fetch';

import { generateAxiosRequestFunction } from '../client';
import type {
  FrameworkAdapterConfig,
  MutationHookBodyContext,
  MutationOnSuccessContext,
  MutationReturnTypeContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { QueryType } from '../query-options';
import { vueUnRefParams, vueWrapTypeWithMaybeRef } from '../utils';

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
    return vueWrapTypeWithMaybeRef(props);
  },

  shouldDestructureNamedPathParams(): boolean {
    // Vue keeps param.name for named path params (doesn't destructure)
    return false;
  },

  getHttpFunctionQueryProps(
    queryProperties: string,
    httpClient: OutputHttpClient,
  ): string {
    // Vue with fetch: unref each prop
    if (httpClient === OutputHttpClient.FETCH && queryProperties) {
      return queryProperties
        .split(',')
        .map((prop) => `unref(${prop})`)
        .join(',');
    }
    return queryProperties;
  },

  getInfiniteQueryHttpProps(
    props: GetterProps,
    queryParam: string,
    httpClient: OutputHttpClient,
  ): string {
    return props
      .map((param) => {
        // Vue does NOT destructure named path params (keeps param.name)
        if (param.name === 'params') {
          return `{...unref(params), '${queryParam}': pageParam ?? unref(params)?.['${queryParam}']}`;
        }

        // Fetch-style request functions accept plain values, but axios-style
        // accept MaybeRef<T> so they unref MaybeRef values internally.
        return httpClient === OutputHttpClient.FETCH
          ? `unref(${param.name})`
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

  getUnrefStatements(props: GetterProps): string {
    return vueUnRefParams(
      props.filter((prop) => prop.type === GetterPropType.NAMED_PATH_PARAMS),
    );
  },

  generateEnabledOption(
    params: GetterParams,
    options?: object | boolean,
  ): string {
    if (params.length === 0) return '';
    if (!isObject(options) || !Object.hasOwn(options, 'enabled')) {
      return `enabled: computed(() => ${params
        .map(
          ({ name }) =>
            `unref(${name}) !== null && unref(${name}) !== undefined`,
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

  generateRequestFunction(
    verbOptions: GeneratorVerbOptions,
    options: GeneratorOptions,
  ): string {
    return options.context.output.httpClient === OutputHttpClient.AXIOS
      ? generateAxiosRequestFunction(verbOptions, options, true)
      : generateFetchRequestFunction(verbOptions, options);
  },

  getQueryPropertyForProp(
    prop: GetterProp,
    body: { implementation: string },
  ): string {
    // Vue does NOT destructure named path params (keeps param.name for reactivity)
    return prop.type === GetterPropType.BODY ? body.implementation : prop.name;
  },
});
