import { OutputClient, type OutputClientFunc, pascal } from '@orval/core';

import { isSuspenseQuery, QueryType } from './query-options';
import { isAngular, isVue } from './utils';

export const generateQueryReturnType = ({
  outputClient,
  type,
  isMutatorHook,
  operationName,
  hasVueQueryV4,
  hasSvelteQueryV4,
  hasQueryV5,
  hasQueryV5WithDataTagError,
  isInitialDataDefined,
}: {
  outputClient: OutputClient | OutputClientFunc;
  type: (typeof QueryType)[keyof typeof QueryType];
  isMutatorHook?: boolean;
  operationName: string;
  hasVueQueryV4: boolean;
  hasSvelteQueryV4: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  isInitialDataDefined?: boolean;
}) => {
  switch (outputClient) {
    case OutputClient.ANGULAR_QUERY: {
      if (type !== QueryType.INFINITE && type !== QueryType.SUSPENSE_INFINITE) {
        return `CreateQueryResult<TData, TError>`;
      }
      return `CreateInfiniteQueryResult<TData, TError>`;
    }
    case OutputClient.SVELTE_QUERY: {
      if (!hasSvelteQueryV4) {
        return `Use${pascal(type)}StoreResult<Awaited<ReturnType<${
          isMutatorHook
            ? `ReturnType<typeof use${pascal(operationName)}Hook>`
            : `typeof ${operationName}`
        }>>, TError, TData, QueryKey> & { queryKey: QueryKey} }`;
      }

      return `Create${pascal(
        type,
      )}Result<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
    }
    case OutputClient.VUE_QUERY: {
      if (!hasVueQueryV4) {
        return ` UseQueryReturnType<TData, TError, Use${pascal(
          type,
        )}Result<TData, TError>> & { queryKey: QueryKey} }`;
      }

      if (type !== QueryType.INFINITE && type !== QueryType.SUSPENSE_INFINITE) {
        return `UseQueryReturnType<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
      }

      return `UseInfiniteQueryReturnType<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
    }
    default: {
      return ` ${
        isInitialDataDefined && !isSuspenseQuery(type) ? 'Defined' : ''
      }Use${pascal(type)}Result<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
    }
  }
};

export const generateMutatorReturnType = ({
  outputClient,
  dataType,
  variableType,
}: {
  outputClient: OutputClient | OutputClientFunc;
  dataType: string;
  variableType: string;
}) => {
  if (outputClient === OutputClient.ANGULAR_QUERY) {
    return `: CreateMutationResult<
        Awaited<ReturnType<${dataType}>>,
        TError,
        ${variableType},
        TContext
      >`;
  }
  if (outputClient === OutputClient.REACT_QUERY) {
    return `: UseMutationResult<
        Awaited<ReturnType<${dataType}>>,
        TError,
        ${variableType},
        TContext
      >`;
  }
  if (outputClient === OutputClient.SVELTE_QUERY) {
    return `: CreateMutationResult<
        Awaited<ReturnType<${dataType}>>,
        TError,
        ${variableType},
        TContext
      >`;
  }
  if (outputClient === OutputClient.VUE_QUERY) {
    return `: UseMutationReturnType<
        Awaited<ReturnType<${dataType}>>,
        TError,
        ${variableType},
        TContext
      >`;
  }
  return '';
};

export const getQueryFnArguments = ({
  hasQueryParam,
  hasSignal,
}: {
  hasQueryParam: boolean;
  hasSignal: boolean;
}) => {
  if (!hasQueryParam && !hasSignal) {
    return '';
  }

  if (hasQueryParam) {
    if (hasSignal) {
      return '{ signal, pageParam }';
    }

    return '{ pageParam }';
  }

  return '{ signal }';
};

export const getQueryReturnStatement = ({
  outputClient,
  hasSvelteQueryV4,
  hasSvelteQueryV6,
  hasQueryV5,
  hasQueryV5WithDataTagError,
  queryResultVarName,
  queryOptionsVarName,
}: {
  outputClient: OutputClient | OutputClientFunc;
  hasSvelteQueryV4: boolean;
  hasSvelteQueryV6: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  queryResultVarName: string;
  queryOptionsVarName: string;
}): string => {
  if (isAngular(outputClient)) {
    return `return ${queryResultVarName};`;
  }

  if (isVue(outputClient)) {
    const queryKeyType = hasQueryV5
      ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>`
      : 'QueryKey';
    return `${queryResultVarName}.queryKey = unref(${queryOptionsVarName}).queryKey as ${queryKeyType};

  return ${queryResultVarName};`;
  }

  if (hasSvelteQueryV4 || hasSvelteQueryV6) {
    return `${queryResultVarName}.queryKey = ${queryOptionsVarName}.queryKey;

  return ${queryResultVarName};`;
  }

  return `return { ...${queryResultVarName}, queryKey: ${queryOptionsVarName}.queryKey };`;
};
