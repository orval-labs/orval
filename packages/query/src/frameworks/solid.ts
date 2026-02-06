import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
  OutputClient,
  OutputHttpClient,
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

export const createSolidAdapter = ({
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
}: {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
}): FrameworkAdapterConfig => ({
  outputClient: OutputClient.SOLID_QUERY,
  hookPrefix: 'create',
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,

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

  generateRequestFunction(
    verbOptions: GeneratorVerbOptions,
    options: GeneratorOptions,
  ): string {
    return options.context.output.httpClient === OutputHttpClient.AXIOS
      ? generateAxiosRequestFunction(verbOptions, options, false)
      : generateFetchRequestFunction(verbOptions, options);
  },
});
