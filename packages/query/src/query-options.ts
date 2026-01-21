import {
  type GeneratorMutator,
  type GetterParams,
  type GetterQueryParam,
  isObject,
  OutputClient,
  type OutputClientFunc,
  OutputHttpClient,
  pascal,
  stringify,
} from '@orval/core';
import { omitBy } from 'remeda';

import { getQueryArgumentsRequestType } from './client';
import { isVue } from './utils';

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
  outputClient,
}: {
  params: GetterParams;
  options?: object | boolean;
  type: QueryType;
  outputClient: OutputClient | OutputClientFunc;
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

  return `${
    !isObject(options) || !Object.hasOwn(options, 'enabled')
      ? isVue(outputClient)
        ? `enabled: computed(() => !!(${params
            .map(({ name }) => `unref(${name})`)
            .join(' && ')})),`
        : `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`
      : ''
  }${queryConfig} ...queryOptions`;
};

export const isSuspenseQuery = (type: QueryType) => {
  return [QueryType.SUSPENSE_INFINITE, QueryType.SUSPENSE_QUERY].includes(type);
};

export const getQueryOptionsDefinition = ({
  operationName,
  mutator,
  definitions,
  type,
  hasSvelteQueryV4,
  hasQueryV5,
  hasQueryV5WithInfiniteQueryOptionsError,
  queryParams,
  queryParam,
  isReturnType,
  initialData,
  isAngularClient,
}: {
  operationName: string;
  mutator?: GeneratorMutator;
  definitions: string;
  type?: QueryType;
  hasSvelteQueryV4: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  queryParams?: GetterQueryParam;
  queryParam?: string;
  isReturnType: boolean;
  initialData?: 'defined' | 'undefined';
  isAngularClient: boolean;
}) => {
  const isMutatorHook = mutator?.isHook;
  const prefix = !hasSvelteQueryV4 && !isAngularClient ? 'Use' : 'Create';
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

export const generateQueryArguments = ({
  operationName,
  definitions,
  mutator,
  isRequestOptions,
  type,
  hasSvelteQueryV4,
  hasSvelteQueryV6,
  hasQueryV5,
  hasQueryV5WithInfiniteQueryOptionsError,
  queryParams,
  queryParam,
  initialData,
  httpClient,
  isAngularClient,
  forQueryOptions = false,
  forAngularInject = false,
}: {
  operationName: string;
  definitions: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  type?: QueryType;
  hasSvelteQueryV4: boolean;
  hasSvelteQueryV6: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  queryParams?: GetterQueryParam;
  queryParam?: string;
  initialData?: 'defined' | 'undefined';
  httpClient: OutputHttpClient;
  isAngularClient: boolean;
  /** When true, include http: HttpClient parameter (for getQueryOptions/getMutationOptions).
   *  When false, don't include it (for inject* functions which inject internally). */
  forQueryOptions?: boolean;
  /** When true, wrap options type in getter alternative for Angular reactive support. */
  forAngularInject?: boolean;
}) => {
  const definition = getQueryOptionsDefinition({
    operationName,
    mutator,
    definitions,
    type,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    queryParams,
    queryParam,
    isReturnType: false,
    initialData,
    isAngularClient,
  });

  // Note: For Angular Query, http: HttpClient is added as the FIRST parameter
  // directly in the query-generator.ts/mutation-generator.ts templates,
  // not here, so that http comes before any optional params (avoiding TS1016).

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

  // For Angular inject* functions, allow options to be a getter for reactivity
  if (forAngularInject) {
    return `options${isQueryRequired ? '' : '?'}: ${optionsType} | (() => ${optionsType})\n`;
  }

  return `options${isQueryRequired ? '' : '?'}: ${hasSvelteQueryV6 && !forQueryOptions ? '() => ' : ''}${optionsType}\n`;
};
