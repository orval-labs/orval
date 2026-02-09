import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
  OutputClient,
  OutputHttpClient,
  toObjectString,
} from '@orval/core';
import { generateRequestFunction as generateFetchRequestFunction } from '@orval/fetch';

import { generateAxiosRequestFunction } from '../client';
import type {
  FrameworkAdapterConfig,
  MutationHookBodyContext,
  MutationReturnTypeContext,
  QueryInvocationContext,
  QueryReturnStatementContext,
  QueryReturnTypeContext,
} from '../framework-adapter';
import { QueryType } from '../query-options';

export const createSolidAdapter = ({
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
  hasSolidQueryUsePrefix,
}: {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  hasSolidQueryUsePrefix: boolean;
}): FrameworkAdapterConfig => ({
  outputClient: OutputClient.SOLID_QUERY,
  hookPrefix: hasSolidQueryUsePrefix ? 'use' : 'create',
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,

  getQueryOptionsDefinitionPrefix(): string {
    return hasSolidQueryUsePrefix ? 'Use' : 'Create';
  },

  getQueryReturnType({ type }: QueryReturnTypeContext): string {
    const prefix = hasSolidQueryUsePrefix ? 'Use' : 'Create';
    const queryKeyType = hasQueryV5
      ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>`
      : 'QueryKey';

    if (type !== QueryType.INFINITE && type !== QueryType.SUSPENSE_INFINITE) {
      return `${prefix}QueryResult<TData, TError> & { queryKey: ${queryKeyType} }`;
    }
    return `${prefix}InfiniteQueryResult<TData, TError> & { queryKey: ${queryKeyType} }`;
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
    // Don't spread the query result - it breaks Solid's store reactivity
    // Instead, attach queryKey as a property
    return `${queryResultVarName}.queryKey = ${queryOptionsVarName}.queryKey; return ${queryResultVarName};`;
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

  generateRequestFunction(
    verbOptions: GeneratorVerbOptions,
    options: GeneratorOptions,
  ): string {
    return options.context.output.httpClient === OutputHttpClient.AXIOS
      ? generateAxiosRequestFunction(verbOptions, options, false)
      : generateFetchRequestFunction(verbOptions, options);
  },
});
