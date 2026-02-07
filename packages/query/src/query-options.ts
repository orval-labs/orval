import {
  type GeneratorMutator,
  type GetterParams,
  type GetterQueryParam,
  isObject,
  pascal,
  stringify,
} from '@orval/core';
import { omitBy } from 'remeda';

import type { FrameworkAdapter } from './framework-adapter';

type QueryType = 'infiniteQuery' | 'query';

export const QueryType = {
  INFINITE: 'infiniteQuery' as QueryType,
  QUERY: 'query' as QueryType,
  SUSPENSE_QUERY: 'suspenseQuery' as QueryType,
  SUSPENSE_INFINITE: 'suspenseInfiniteQuery' as QueryType,
};

const INFINITE_QUERY_PROPERTIES = new Set([
  'getNextPageParam',
  'getPreviousPageParam',
]);

export const generateQueryOptions = ({
  params,
  options,
  type,
  adapter,
}: {
  params: GetterParams;
  options?: object | boolean;
  type: QueryType;
  adapter?: FrameworkAdapter;
}) => {
  if (options === false) {
    return '';
  }

  const queryConfig = isObject(options)
    ? ` ${stringify(
        omitBy(
          options,
          (_, key) =>
            type !== QueryType.INFINITE &&
            type !== QueryType.SUSPENSE_INFINITE &&
            INFINITE_QUERY_PROPERTIES.has(key),
        ),
      )?.slice(1, -1)}`
    : '';

  if (params.length === 0 || isSuspenseQuery(type)) {
    if (options) {
      return `${queryConfig} ...queryOptions`;
    }

    return '...queryOptions';
  }

  const enabledOption = adapter
    ? adapter.generateEnabledOption(params, options)
    : !isObject(options) || !Object.hasOwn(options, 'enabled')
      ? `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`
      : '';

  return `${enabledOption}${queryConfig} ...queryOptions`;
};

export const isSuspenseQuery = (type: QueryType) => {
  return [QueryType.SUSPENSE_INFINITE, QueryType.SUSPENSE_QUERY].includes(type);
};

export const getQueryOptionsDefinition = ({
  operationName,
  mutator,
  definitions,
  type,
  prefix,
  hasQueryV5,
  hasQueryV5WithInfiniteQueryOptionsError,
  queryParams,
  queryParam,
  isReturnType,
  initialData,
}: {
  operationName: string;
  mutator?: GeneratorMutator;
  definitions: string;
  type?: QueryType;
  /** 'Use' or 'Create' — from adapter.getQueryOptionsDefinitionPrefix() */
  prefix: string;
  hasQueryV5: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  queryParams?: GetterQueryParam;
  queryParam?: string;
  isReturnType: boolean;
  initialData?: 'defined' | 'undefined';
}) => {
  const isMutatorHook = mutator?.isHook;
  const partialOptions = !isReturnType && hasQueryV5;

  if (type) {
    const funcReturnType = `Awaited<ReturnType<${
      isMutatorHook
        ? `ReturnType<typeof use${pascal(operationName)}Hook>`
        : `typeof ${operationName}`
    }>>`;

    const optionTypeInitialDataPostfix =
      initialData && !isSuspenseQuery(type)
        ? ` & Pick<
        ${pascal(initialData)}InitialDataOptions<
          ${funcReturnType},
          TError,
          ${funcReturnType}${
            hasQueryV5 &&
            (type === QueryType.INFINITE ||
              type === QueryType.SUSPENSE_INFINITE) &&
            queryParam &&
            queryParams
              ? `, QueryKey`
              : ''
          }
        > , 'initialData'
      >`
        : '';
    const optionType = `${prefix}${pascal(type)}Options<${funcReturnType}, TError, TData${
      hasQueryV5 &&
      (type === QueryType.INFINITE || type === QueryType.SUSPENSE_INFINITE) &&
      queryParam &&
      queryParams
        ? hasQueryV5WithInfiniteQueryOptionsError
          ? `, QueryKey, ${queryParams.schema.name}['${queryParam}']`
          : `, ${funcReturnType}, QueryKey, ${queryParams.schema.name}['${queryParam}']`
        : ''
    }>`;
    return `${partialOptions ? 'Partial<' : ''}${optionType}${
      partialOptions ? '>' : ''
    }${optionTypeInitialDataPostfix}`;
  }

  return `${prefix}MutationOptions<Awaited<ReturnType<${
    isMutatorHook
      ? `ReturnType<typeof use${pascal(operationName)}Hook>`
      : `typeof ${operationName}`
  }>>, TError,${definitions ? `{${definitions}}` : 'void'}, TContext>`;
};
