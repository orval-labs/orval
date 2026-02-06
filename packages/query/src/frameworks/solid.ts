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
  toObjectString,
} from '@orval/core';
import { generateRequestFunction as generateFetchRequestFunction } from '@orval/fetch';

import {
  generateAxiosRequestFunction,
  getQueryArgumentsRequestType,
} from '../client';
import type {
  FrameworkAdapter,
  MutationHookBodyContext,
  MutationReturnTypeContext,
  QueryInitContext,
  QueryInvocationContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { getQueryOptionsDefinition, QueryType } from '../query-options';

export const createSolidAdapter = ({
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
}: {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
}): FrameworkAdapter => ({
  outputClient: OutputClient.SOLID_QUERY,
  hookPrefix: 'create',
  isAngularHttp: false,
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,

  transformProps(props: GetterProps): GetterProps {
    return props;
  },

  getHookPropsDefinitions(props: GetterProps): string {
    return toObjectString(props, 'implementation');
  },

  shouldDestructureNamedPathParams(): boolean {
    return true;
  },

  getHttpFunctionQueryProps(
    queryProperties: string,
    _httpClient: OutputHttpClient,
  ): string {
    return queryProperties;
  },

  getHttpFirstParam(): string {
    return '';
  },

  getMutationHttpPrefix(): string {
    return '';
  },

  getInfiniteQueryHttpProps(props: GetterProps, queryParam: string): string {
    return props
      .map((param) => {
        if (param.type === GetterPropType.NAMED_PATH_PARAMS)
          return param.destructured;
        return param.name === 'params'
          ? `{...params, '${queryParam}': pageParam || params?.['${queryParam}']}`
          : param.name;
      })
      .join(',');
  },

  getQueryReturnType({ type }: QueryReturnTypeContext): string {
    if (type !== QueryType.INFINITE && type !== QueryType.SUSPENSE_INFINITE) {
      return `CreateQueryResult<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
    }
    return `CreateInfiniteQueryResult<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
  },

  getMutationReturnType({
    dataType,
    variableType,
  }: MutationReturnTypeContext): string {
    return `: CreateMutationResult<
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
    return `return { ...${queryResultVarName}, queryKey: ${queryOptionsVarName}.queryKey };`;
  },

  getQueryKeyRouteString(route: string, shouldSplitQueryKey: boolean): string {
    if (shouldSplitQueryKey) {
      return getRouteAsArray(route);
    }
    return `\`${route}\``;
  },

  shouldAnnotateQueryKey(): boolean {
    return true;
  },

  getUnrefStatements(): string {
    return '';
  },

  generateQueryInit({
    queryOptionsFnName,
    queryProperties,
    isRequestOptions,
  }: QueryInitContext): string {
    const queryOptionsVarName = isRequestOptions ? 'queryOptions' : 'options';
    return `const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
      queryProperties ? ',' : ''
    }${isRequestOptions ? 'options' : 'queryOptions'})`;
  },

  generateQueryInvocationArgs({
    queryOptionsVarName,
    optionalQueryClientArgument,
  }: QueryInvocationContext): string {
    return `${queryOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''}`;
  },

  getQueryInvocationSuffix(): string {
    return '';
  },

  shouldGenerateOverrideTypes(): boolean {
    return false;
  },

  getOptionalQueryClientArgument(): string {
    return hasQueryV5 ? ', queryClient?: QueryClient' : '';
  },

  getQueryOptionsDefinitionPrefix(): string {
    return 'Use';
  },

  generateEnabledOption(
    params: GetterParams,
    options?: object | boolean,
  ): string {
    if (!isObject(options) || !Object.hasOwn(options, 'enabled')) {
      return `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`;
    }
    return '';
  },

  getQueryKeyPrefix(): string {
    return 'queryOptions?.queryKey ?? ';
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
    return `      return ${operationPrefix}Mutation(${mutationImplementation}${optionalQueryClientArgument ? `, queryClient` : ''});`;
  },

  getQueryType(type: string): string {
    return type;
  },

  generateRequestFunction(
    verbOptions: GeneratorVerbOptions,
    options: GeneratorOptions,
  ): string {
    return options.context.output.httpClient === OutputHttpClient.AXIOS
      ? generateAxiosRequestFunction(verbOptions, options, false)
      : generateFetchRequestFunction(verbOptions, options);
  },

  getQueryPropertyForProp(
    prop: GetterProp,
    body: { implementation: string },
  ): string {
    if (prop.type === GetterPropType.NAMED_PATH_PARAMS)
      return prop.destructured;
    return prop.type === GetterPropType.BODY ? body.implementation : prop.name;
  },
});
