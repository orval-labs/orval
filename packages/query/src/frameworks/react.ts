import {
  type GeneratorOptions,
  type GeneratorVerbOptions,
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
import { isSuspenseQuery } from '../query-options';

export const createReactAdapter = ({
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
}: {
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
}): FrameworkAdapterConfig => ({
  outputClient: OutputClient.REACT_QUERY,
  hookPrefix: 'use',
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,

  getQueryReturnType({
    type,
    isInitialDataDefined,
  }: QueryReturnTypeContext): string {
    return ` ${
      isInitialDataDefined && !isSuspenseQuery(type) ? 'Defined' : ''
    }Use${pascal(type)}Result<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
  },

  getMutationReturnType({
    dataType,
    variableType,
  }: MutationReturnTypeContext): string {
    return `: UseMutationResult<
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

  shouldGenerateOverrideTypes(): boolean {
    return hasQueryV5;
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
    return true;
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
    if (isRequestOptions) {
      return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, context: TContext) => {
    if (!options?.skipInvalidation) {
${invalidateCalls}
    }
    mutationOptions?.onSuccess?.(data, variables, context);
  };`;
    }
    return `  const onSuccess = (data: Awaited<ReturnType<typeof ${operationName}>>, variables: ${definitions ? `{${definitions}}` : 'void'}, context: TContext) => {
${invalidateCalls}
    mutationOptions?.onSuccess?.(data, variables, context);
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
      ? generateAxiosRequestFunction(verbOptions, options, false)
      : generateFetchRequestFunction(verbOptions, options);
  },
});
