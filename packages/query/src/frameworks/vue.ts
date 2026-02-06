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

import {
  generateAxiosRequestFunction,
  getQueryArgumentsRequestType,
} from '../client';
import type {
  FrameworkAdapterConfig,
  MutationHookBodyContext,
  MutationReturnTypeContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { getQueryOptionsDefinition, QueryType } from '../query-options';
import { vueUnRefParams, vueWrapTypeWithMaybeRef } from '../utils';

export const createVueAdapter = ({
  hasVueQueryV4,
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
}: {
  hasVueQueryV4: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
}): FrameworkAdapterConfig => ({
  outputClient: OutputClient.VUE_QUERY,
  hookPrefix: 'use',
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,

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

  getInfiniteQueryHttpProps(props: GetterProps, queryParam: string): string {
    return props
      .map((param) => {
        // Vue does NOT destructure named path params (keeps param.name)
        return param.name === 'params'
          ? `{...unref(params), '${queryParam}': pageParam || unref(params)?.['${queryParam}']}`
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
    if (!isObject(options) || !Object.hasOwn(options, 'enabled')) {
      return `enabled: computed(() => !!(${params
        .map(({ name }) => `unref(${name})`)
        .join(' && ')})),`;
    }
    return '';
  },

  getQueryKeyPrefix(): string {
    return hasVueQueryV4 ? '' : 'queryOptions?.queryKey ?? ';
  },

  generateQueryArguments({
    operationName,
    definitions,
    mutator,
    isRequestOptions,
    type,
    queryParams,
    queryParam,
    initialData,
    httpClient,
  }): string {
    const definition = getQueryOptionsDefinition({
      operationName,
      mutator,
      definitions,
      type,
      prefix: 'Use',
      hasQueryV5,
      hasQueryV5WithInfiniteQueryOptionsError,
      queryParams,
      queryParam,
      isReturnType: false,
      initialData,
    });

    if (!isRequestOptions) {
      return `${type ? 'queryOptions' : 'mutationOptions'}${
        initialData === 'defined' ? '' : '?'
      }: ${definition}`;
    }

    const requestType = getQueryArgumentsRequestType(httpClient, mutator);
    const isQueryRequired = initialData === 'defined';
    const optionsType = `{ ${
      type ? 'query' : 'mutation'
    }${isQueryRequired ? '' : '?'}:${definition}, ${requestType}}`;

    return `options${isQueryRequired ? '' : '?'}: ${optionsType}\n`;
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
    // Vue is NOT in the list: isAngularClient || isReact(outputClient) || isSvelte(outputClient)
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
    return `      return ${operationPrefix}Mutation(${mutationImplementation}${optionalQueryClientArgument ? `, queryClient` : ''});`;
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
