import {
  camel,
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientExtraFilesBuilder,
  type ClientFileBuilder,
  type ClientHeaderBuilder,
  compareVersions,
  type ContextSpecs,
  generateMutator,
  generateMutatorImports,
  generateVerbImports,
  type GeneratorDependency,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getFileInfo,
  getRouteAsArray,
  type GetterParams,
  type GetterProp,
  type GetterProps,
  GetterPropType,
  type GetterQueryParam,
  type GetterResponse,
  isObject,
  jsDoc,
  kebab,
  mergeDeep,
  ModelStyle,
  type NormalizedOutputOptions,
  OutputClient,
  type OutputClientFunc,
  OutputHttpClient,
  type PackageJson,
  pascal,
  type QueryOptions,
  stringify,
  toObjectString,
  upath,
  Verbs,
} from '@orval/core';
import { generateZod, getZodDependencies } from '@orval/zod';
import type { InfoObject } from 'openapi3-ts/oas30';
import { omitBy } from 'remeda';

import {
  AXIOS_DEPENDENCIES,
  generateQueryRequestFunction,
  getHookOptions,
  getHooksOptionImplementation,
  getHttpFunctionQueryProps,
  getMutationRequestArgs,
  getQueryArgumentsRequestType,
  getQueryErrorType,
  getQueryHeader,
  getQueryOptions,
} from './client';
import {
  getHasSignal,
  isVue,
  normalizeQueryOptions,
  vueUnRefParams,
  vueWrapTypeWithMaybeRef,
} from './utils';

const REACT_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'useCallback',
        values: true,
      },
    ],
    dependency: 'react',
  },
];

const PARAMS_SERIALIZER_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'qs',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
    ],
    dependency: 'qs',
  },
];

const SVELTE_QUERY_DEPENDENCIES_V3: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useQuery', values: true },
      { name: 'useInfiniteQuery', values: true },
      { name: 'useMutation', values: true },
      { name: 'UseQueryOptions' },
      {
        name: 'UseInfiniteQueryOptions',
      },
      { name: 'UseMutationOptions' },
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
      { name: 'UseQueryStoreResult' },
      { name: 'UseInfiniteQueryStoreResult' },
      { name: 'QueryKey' },
      { name: 'CreateMutationResult' },
      { name: 'InvalidateOptions' },
    ],
    dependency: '@sveltestack/svelte-query',
  },
];
const SVELTE_QUERY_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'createQuery', values: true },
      { name: 'createInfiniteQuery', values: true },
      { name: 'createMutation', values: true },
      { name: 'CreateQueryOptions' },
      {
        name: 'CreateInfiniteQueryOptions',
      },
      { name: 'CreateMutationOptions' },
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
      { name: 'CreateQueryResult' },
      { name: 'CreateInfiniteQueryResult' },
      { name: 'QueryKey' },
      { name: 'InfiniteData' },
      { name: 'CreateMutationResult' },
      { name: 'DataTag' },
      { name: 'QueryClient' },
      { name: 'InvalidateOptions' },
    ],
    dependency: '@tanstack/svelte-query',
  },
];

const isSvelteQueryV3 = (packageJson: PackageJson | undefined) => {
  const hasSvelteQuery =
    packageJson?.dependencies?.['@sveltestack/svelte-query'] ??
    packageJson?.devDependencies?.['@sveltestack/svelte-query'] ??
    packageJson?.peerDependencies?.['@sveltestack/svelte-query'];
  const hasSvelteQueryV4 =
    packageJson?.dependencies?.['@tanstack/svelte-query'] ??
    packageJson?.devDependencies?.['@tanstack/svelte-query'] ??
    packageJson?.peerDependencies?.['@tanstack/svelte-query'];

  return !!hasSvelteQuery && !hasSvelteQueryV4;
};

const isSvelteQueryV6 = (packageJson: PackageJson | undefined) => {
  return isQueryV6(packageJson, 'svelte-query');
};

export const getSvelteQueryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator,
  hasParamsSerializerOptions,
  packageJson,
  httpClient?: OutputHttpClient,
) => {
  const hasSvelteQueryV3 = isSvelteQueryV3(packageJson);

  return [
    ...(!hasGlobalMutator && httpClient === OutputHttpClient.AXIOS
      ? AXIOS_DEPENDENCIES
      : []),
    ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
    ...(hasSvelteQueryV3
      ? SVELTE_QUERY_DEPENDENCIES_V3
      : SVELTE_QUERY_DEPENDENCIES),
  ];
};

const REACT_QUERY_DEPENDENCIES_V3: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useQuery', values: true },
      { name: 'useInfiniteQuery', values: true },
      { name: 'useMutation', values: true },
      { name: 'useQueryClient', values: true },
      { name: 'UseQueryOptions' },
      { name: 'UseInfiniteQueryOptions' },
      { name: 'UseMutationOptions' },
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
      { name: 'UseQueryResult' },
      { name: 'UseInfiniteQueryResult' },
      { name: 'QueryKey' },
      { name: 'QueryClient' },
      { name: 'UseMutationResult' },
      { name: 'InvalidateOptions' },
    ],
    dependency: 'react-query',
  },
];
const REACT_QUERY_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useQuery', values: true },
      { name: 'useSuspenseQuery', values: true },
      { name: 'useInfiniteQuery', values: true },
      { name: 'useSuspenseInfiniteQuery', values: true },
      { name: 'useMutation', values: true },
      { name: 'useQueryClient', values: true },
      { name: 'UseQueryOptions' },
      { name: 'DefinedInitialDataOptions' },
      { name: 'UndefinedInitialDataOptions' },
      { name: 'UseSuspenseQueryOptions' },
      { name: 'UseInfiniteQueryOptions' },
      { name: 'UseSuspenseInfiniteQueryOptions' },
      { name: 'UseMutationOptions' },
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
      { name: 'UseQueryResult' },
      { name: 'DefinedUseQueryResult' },
      { name: 'UseSuspenseQueryResult' },
      { name: 'UseInfiniteQueryResult' },
      { name: 'DefinedUseInfiniteQueryResult' },
      { name: 'UseSuspenseInfiniteQueryResult' },
      { name: 'QueryKey' },
      { name: 'QueryClient' },
      { name: 'InfiniteData' },
      { name: 'UseMutationResult' },
      { name: 'DataTag' },
      { name: 'InvalidateOptions' },
    ],
    dependency: '@tanstack/react-query',
  },
];

export const getReactQueryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator,
  hasParamsSerializerOptions,
  packageJson,
  httpClient,
  hasTagsMutator,
  override,
) => {
  const hasReactQuery =
    packageJson?.dependencies?.['react-query'] ??
    packageJson?.devDependencies?.['react-query'] ??
    packageJson?.peerDependencies?.['react-query'];
  const hasReactQueryV4 =
    packageJson?.dependencies?.['@tanstack/react-query'] ??
    packageJson?.devDependencies?.['@tanstack/react-query'] ??
    packageJson?.peerDependencies?.['@tanstack/react-query'];

  const useReactQueryV3 =
    override?.query.version === undefined
      ? hasReactQuery && !hasReactQueryV4
      : override?.query.version <= 3;

  return [
    ...(hasGlobalMutator || hasTagsMutator ? REACT_DEPENDENCIES : []),
    ...(!hasGlobalMutator && httpClient === OutputHttpClient.AXIOS
      ? AXIOS_DEPENDENCIES
      : []),
    ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
    ...(useReactQueryV3
      ? REACT_QUERY_DEPENDENCIES_V3
      : REACT_QUERY_DEPENDENCIES),
  ];
};

const VUE_QUERY_DEPENDENCIES_V3: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useQuery', values: true },
      { name: 'useInfiniteQuery', values: true },
      { name: 'useMutation', values: true },
    ],
    dependency: 'vue-query',
  },
  {
    exports: [
      { name: 'UseQueryOptions' },
      { name: 'UseInfiniteQueryOptions' },
      { name: 'UseMutationOptions' },
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
      { name: 'UseQueryResult' },
      { name: 'UseInfiniteQueryResult' },
      { name: 'QueryKey' },
      { name: 'UseMutationReturnType' },
      { name: 'InvalidateOptions' },
    ],
    dependency: 'vue-query/types',
  },
  {
    exports: [
      { name: 'unref', values: true },
      { name: 'computed', values: true },
    ],
    dependency: 'vue',
  },
  {
    exports: [{ name: 'UseQueryReturnType' }],
    dependency: 'vue-query/lib/vue/useBaseQuery',
  },
];

const VUE_QUERY_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useQuery', values: true },
      { name: 'useInfiniteQuery', values: true },
      { name: 'useMutation', values: true },
      { name: 'UseQueryOptions' },
      { name: 'UseInfiniteQueryOptions' },
      { name: 'UseMutationOptions' },
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
      { name: 'QueryKey' },
      { name: 'UseQueryReturnType' },
      { name: 'UseInfiniteQueryReturnType' },
      { name: 'InfiniteData' },
      { name: 'UseMutationReturnType' },
      { name: 'DataTag' },
      { name: 'QueryClient' },
      { name: 'InvalidateOptions' },
    ],
    dependency: '@tanstack/vue-query',
  },
  {
    exports: [
      { name: 'unref', values: true },
      { name: 'MaybeRef' },
      { name: 'computed', values: true },
    ],
    dependency: 'vue',
  },
];

const isVueQueryV3 = (packageJson: PackageJson | undefined) => {
  const hasVueQuery =
    packageJson?.dependencies?.['vue-query'] ??
    packageJson?.devDependencies?.['vue-query'] ??
    packageJson?.peerDependencies?.['vue-query'];
  const hasVueQueryV4 =
    packageJson?.dependencies?.['@tanstack/vue-query'] ??
    packageJson?.devDependencies?.['@tanstack/vue-query'] ??
    packageJson?.peerDependencies?.['@tanstack/vue-query'];

  return !!hasVueQuery && !hasVueQueryV4;
};

export const getVueQueryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator: boolean,
  hasParamsSerializerOptions: boolean,
  packageJson,
  httpClient?: OutputHttpClient,
) => {
  const hasVueQueryV3 = isVueQueryV3(packageJson);

  return [
    ...(!hasGlobalMutator && httpClient === OutputHttpClient.AXIOS
      ? AXIOS_DEPENDENCIES
      : []),
    ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
    ...(hasVueQueryV3 ? VUE_QUERY_DEPENDENCIES_V3 : VUE_QUERY_DEPENDENCIES),
  ];
};

const isQueryV5 = (
  packageJson: PackageJson | undefined,
  queryClient: 'react-query' | 'vue-query' | 'svelte-query',
) => {
  const version = getPackageByQueryClient(packageJson, queryClient);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '5.0.0');
};

const isQueryV6 = (
  packageJson: PackageJson | undefined,
  queryClient: 'react-query' | 'vue-query' | 'svelte-query',
) => {
  const version = getPackageByQueryClient(packageJson, queryClient);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '6.0.0');
};

const isQueryV5WithDataTagError = (
  packageJson: PackageJson | undefined,
  queryClient: 'react-query' | 'vue-query' | 'svelte-query',
) => {
  const version = getPackageByQueryClient(packageJson, queryClient);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '5.62.0');
};

const isQueryV5WithInfiniteQueryOptionsError = (
  packageJson: PackageJson | undefined,
  queryClient: 'react-query' | 'vue-query' | 'svelte-query',
) => {
  const version = getPackageByQueryClient(packageJson, queryClient);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '5.80.0');
};

const getPackageByQueryClient = (
  packageJson: PackageJson | undefined,
  queryClient: 'react-query' | 'vue-query' | 'svelte-query',
) => {
  switch (queryClient) {
    case 'react-query': {
      return (
        packageJson?.dependencies?.['@tanstack/react-query'] ??
        packageJson?.devDependencies?.['@tanstack/react-query'] ??
        packageJson?.peerDependencies?.['@tanstack/react-query']
      );
    }
    case 'svelte-query': {
      return (
        packageJson?.dependencies?.['@tanstack/svelte-query'] ??
        packageJson?.devDependencies?.['@tanstack/svelte-query'] ??
        packageJson?.peerDependencies?.['@tanstack/svelte-query']
      );
    }
    case 'vue-query': {
      return (
        packageJson?.dependencies?.['@tanstack/vue-query'] ??
        packageJson?.devDependencies?.['@tanstack/vue-query'] ??
        packageJson?.peerDependencies?.['@tanstack/vue-query']
      );
    }
  }
};

type QueryType = 'infiniteQuery' | 'query';

const QueryType = {
  INFINITE: 'infiniteQuery' as QueryType,
  QUERY: 'query' as QueryType,
  SUSPENSE_QUERY: 'suspenseQuery' as QueryType,
  SUSPENSE_INFINITE: 'suspenseInfiniteQuery' as QueryType,
};

const INFINITE_QUERY_PROPERTIES = new Set([
  'getNextPageParam',
  'getPreviousPageParam',
]);

const generateQueryOptions = ({
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
            (type !== QueryType.INFINITE ||
              type !== QueryType.SUSPENSE_INFINITE) &&
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
    !isObject(options) || !options.hasOwnProperty('enabled')
      ? isVue(outputClient)
        ? `enabled: computed(() => !!(${params
            .map(({ name }) => `unref(${name})`)
            .join(' && ')})),`
        : `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`
      : ''
  }${queryConfig} ...queryOptions`;
};

const isSuspenseQuery = (type: QueryType) => {
  return [QueryType.SUSPENSE_INFINITE, QueryType.SUSPENSE_QUERY].includes(type);
};

const getQueryOptionsDefinition = ({
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
}) => {
  const isMutatorHook = mutator?.isHook;
  const prefix = hasSvelteQueryV4 ? 'Create' : 'Use';
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
          ? `, QueryKey, ${queryParams?.schema.name}['${queryParam}']`
          : `, ${funcReturnType}, QueryKey, ${queryParams?.schema.name}['${queryParam}']`
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

const generateQueryArguments = ({
  operationName,
  definitions,
  mutator,
  isRequestOptions,
  type,
  hasSvelteQueryV4,
  hasQueryV5,
  hasQueryV5WithInfiniteQueryOptionsError,
  queryParams,
  queryParam,
  initialData,
  httpClient,
}: {
  operationName: string;
  definitions: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  type?: QueryType;
  hasSvelteQueryV4: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  queryParams?: GetterQueryParam;
  queryParam?: string;
  initialData?: 'defined' | 'undefined';
  httpClient: OutputHttpClient;
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
  });

  if (!isRequestOptions) {
    return `${type ? 'queryOptions' : 'mutationOptions'}${
      initialData === 'defined' ? '' : '?'
    }: ${definition}`;
  }

  const requestType = getQueryArgumentsRequestType(httpClient, mutator);

  const isQueryRequired = initialData === 'defined';
  return `options${isQueryRequired ? '' : '?'}: { ${
    type ? 'query' : 'mutation'
  }${isQueryRequired ? '' : '?'}:${definition}, ${requestType}}\n`;
};

const generateQueryReturnType = ({
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
  type: QueryType;
  isMutatorHook?: boolean;
  operationName: string;
  hasVueQueryV4: boolean;
  hasSvelteQueryV4: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  isInitialDataDefined?: boolean;
}) => {
  switch (outputClient) {
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
    case OutputClient.REACT_QUERY:
    default: {
      return ` ${
        isInitialDataDefined && !isSuspenseQuery(type) ? 'Defined' : ''
      }Use${pascal(type)}Result<TData, TError> & { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`;
    }
  }
};

const generateMutatorReturnType = ({
  outputClient,
  dataType,
  variableType,
}: {
  outputClient: OutputClient | OutputClientFunc;
  dataType: unknown;
  variableType: unknown;
}) => {
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

const getQueryFnArguments = ({
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

const generatePrefetch = ({
  usePrefetch,
  type,
  useQuery,
  useInfinite,
  operationName,
  mutator,
  doc,
  queryProps,
  dataType,
  errorType,
  queryArguments,
  queryOptionsVarName,
  queryOptionsFnName,
  queryProperties,
  isRequestOptions,
  hasSvelteQueryV6,
}: {
  operationName: string;
  mutator?: GeneratorMutator;
  type: QueryType;
  usePrefetch?: boolean;
  useQuery?: boolean;
  useInfinite?: boolean;
  doc?: string;
  queryProps: string;
  dataType: string;
  errorType: string;
  queryArguments: string;
  queryOptionsVarName: string;
  queryOptionsFnName: string;
  queryProperties: string;
  isRequestOptions: boolean;
  hasSvelteQueryV6: boolean;
}) => {
  const shouldGeneratePrefetch =
    usePrefetch &&
    (type === QueryType.QUERY ||
      type === QueryType.INFINITE ||
      (type === QueryType.SUSPENSE_QUERY && !useQuery) ||
      (type === QueryType.SUSPENSE_INFINITE && !useInfinite));

  if (!shouldGeneratePrefetch) {
    return '';
  }

  const prefetchType =
    type === QueryType.QUERY || type === QueryType.SUSPENSE_QUERY
      ? 'query'
      : 'infinite-query';
  const prefetchFnName = camel(`prefetch-${prefetchType}`);

  if (mutator?.isHook) {
    const prefetchVarName = camel(
      `use-prefetch-${operationName}-${prefetchType}`,
    );
    return `${doc}export const ${prefetchVarName} = <TData = Awaited<ReturnType<${dataType}>>, TError = ${errorType}>(${queryProps} ${queryArguments}) => {
  const queryClient = useQueryClient();
  const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
    queryProperties ? ',' : ''
  }${isRequestOptions ? 'options' : 'queryOptions'})
  return useCallback(async (): Promise<QueryClient> => {
    await queryClient.${prefetchFnName}(${queryOptionsVarName})
    return queryClient;
  },[queryClient, ${queryOptionsVarName}]);
};\n`;
  } else {
    const prefetchVarName = camel(`prefetch-${operationName}-${prefetchType}`);
    return `${doc}export const ${prefetchVarName} = async <TData = Awaited<ReturnType<${dataType}>>, TError = ${errorType}>(\n queryClient: QueryClient, ${queryProps} ${queryArguments}\n  ): Promise<QueryClient> => {

  const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
    queryProperties ? ',' : ''
  }${isRequestOptions ? 'options' : 'queryOptions'})

  await queryClient.${prefetchFnName}(${
    hasSvelteQueryV6
      ? `() => ({ ...${queryOptionsVarName} })`
      : queryOptionsVarName
  });

  return queryClient;
}\n`;
  }
};

const generateQueryImplementation = ({
  queryOption: { name, queryParam, options, type, queryKeyFnName },
  operationName,
  queryProperties,
  queryKeyProperties,
  queryParams,
  verbOptions,
  params,
  props,
  mutator,
  queryOptionsMutator,
  queryKeyMutator,
  isRequestOptions,
  response,
  outputClient,
  httpClient,
  isExactOptionalPropertyTypes,
  hasSignal,
  route,
  hasVueQueryV4,
  hasSvelteQueryV4,
  hasSvelteQueryV6,
  hasQueryV5,
  hasQueryV5WithDataTagError,
  hasQueryV5WithInfiniteQueryOptionsError,
  doc,
  usePrefetch,
  useQuery,
  useInfinite,
  useInvalidate,
  output,
}: {
  queryOption: {
    name: string;
    options?: object | boolean;
    type: QueryType;
    queryParam?: string;
    queryKeyFnName: string;
  };
  isRequestOptions: boolean;
  operationName: string;
  queryProperties: string;
  queryKeyProperties: string;
  params: GetterParams;
  props: GetterProps;
  response: GetterResponse;
  queryParams?: GetterQueryParam;
  verbOptions: GeneratorVerbOptions;
  mutator?: GeneratorMutator;
  queryOptionsMutator?: GeneratorMutator;
  queryKeyMutator?: GeneratorMutator;
  outputClient: OutputClient | OutputClientFunc;
  httpClient: OutputHttpClient;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  route: string;
  hasVueQueryV4: boolean;
  hasSvelteQueryV4: boolean;
  hasSvelteQueryV6: boolean;
  hasQueryV5: boolean;
  hasQueryV5WithDataTagError: boolean;
  hasQueryV5WithInfiniteQueryOptionsError: boolean;
  doc?: string;
  usePrefetch?: boolean;
  useQuery?: boolean;
  useInfinite?: boolean;
  useInvalidate?: boolean;
  output: NormalizedOutputOptions;
}) => {
  const queryPropDefinitions = toObjectString(props, 'definition');
  const definedInitialDataQueryPropsDefinitions = toObjectString(
    props.map((prop) => {
      const regex = new RegExp(`^${prop.name}\\s*\\?:`);

      if (!regex.test(prop.definition)) {
        return prop;
      }

      const definitionWithUndefined = prop.definition.replace(
        regex,
        `${prop.name}: undefined | `,
      );
      return {
        ...prop,
        definition: definitionWithUndefined,
      };
    }),
    'definition',
  );
  const queryProps = toObjectString(props, 'implementation');

  const hasInfiniteQueryParam = queryParam && queryParams?.schema.name;

  const httpFunctionProps = queryParam
    ? props
        .map((param) => {
          if (
            param.type === GetterPropType.NAMED_PATH_PARAMS &&
            !isVue(outputClient)
          )
            return param.destructured;
          return param.name === 'params'
            ? `{...${
                isVue(outputClient) ? `unref(params)` : 'params'
              }, '${queryParam}': pageParam || ${
                isVue(outputClient)
                  ? `unref(params)?.['${queryParam}']`
                  : `params?.['${queryParam}']`
              }}`
            : param.name;
        })
        .join(',')
    : getHttpFunctionQueryProps(
        isVue(outputClient),
        httpClient,
        queryProperties,
      );

  const definedInitialDataReturnType = generateQueryReturnType({
    outputClient,
    type,
    isMutatorHook: mutator?.isHook,
    operationName,
    hasVueQueryV4,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithDataTagError,
    isInitialDataDefined: true,
  });
  const returnType = generateQueryReturnType({
    outputClient,
    type,
    isMutatorHook: mutator?.isHook,
    operationName,
    hasVueQueryV4,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithDataTagError,
  });

  const errorType = getQueryErrorType(
    operationName,
    response,
    httpClient,
    mutator,
  );

  // For zod model style, use zod types instead of ReturnType
  const isZodModelStyle = output.modelStyle === ModelStyle.ZOD;

  // For zod model style, use type names from response definition directly
  // Otherwise, use typeof for the function (we'll wrap it in Awaited<ReturnType<>> later)
  const dataType =
    isZodModelStyle && response.definition.success
      ? response.definition.success
      : mutator?.isHook
        ? `ReturnType<typeof use${pascal(operationName)}Hook>`
        : `typeof ${operationName}`;

  const definedInitialDataQueryArguments = generateQueryArguments({
    operationName,
    mutator,
    definitions: '',
    isRequestOptions,
    type,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    queryParams,
    queryParam,
    initialData: 'defined',
    httpClient,
  });
  const undefinedInitialDataQueryArguments = generateQueryArguments({
    operationName,
    definitions: '',
    mutator,
    isRequestOptions,
    type,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    queryParams,
    queryParam,
    initialData: 'undefined',
    httpClient,
  });
  const queryArguments = generateQueryArguments({
    operationName,
    definitions: '',
    mutator,
    isRequestOptions,
    type,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    queryParams,
    queryParam,
    httpClient,
  });

  const queryOptions = getQueryOptions({
    isRequestOptions,
    isExactOptionalPropertyTypes,
    mutator,
    hasSignal,
    httpClient,
  });

  const hookOptions = getHookOptions({
    isRequestOptions,
    httpClient,
    mutator,
  });

  const queryFnArguments = getQueryFnArguments({
    hasQueryParam:
      !!queryParam && props.some(({ type }) => type === 'queryParam'),
    hasSignal,
  });

  const queryOptionFnReturnType = getQueryOptionsDefinition({
    operationName,
    mutator,
    definitions: '',
    type,
    hasSvelteQueryV4,
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    queryParams,
    queryParam,
    isReturnType: true,
  });

  const queryOptionsImp = generateQueryOptions({
    params,
    options,
    type,
    outputClient,
  });

  const queryOptionsFnName = camel(
    queryKeyMutator || queryOptionsMutator || mutator?.isHook
      ? `use-${name}-queryOptions`
      : `get-${name}-queryOptions`,
  );

  const queryOptionsVarName = isRequestOptions ? 'queryOptions' : 'options';

  const hasParamReservedWord = props.some(
    (prop: GetterProp) => prop.name === 'query',
  );
  const queryResultVarName = hasParamReservedWord ? '_query' : 'query';

  const infiniteParam =
    queryParams && queryParam
      ? `, ${queryParams?.schema.name}['${queryParam}']`
      : '';
  // For zod model style, TData is already the zod type (not wrapped in ReturnType)
  // For others, wrap in Awaited<ReturnType<>>
  const TData =
    isZodModelStyle && response.definition.success
      ? hasQueryV5 &&
        (type === QueryType.INFINITE || type === QueryType.SUSPENSE_INFINITE)
        ? `InfiniteData<${dataType}${infiniteParam}>`
        : dataType
      : hasQueryV5 &&
          (type === QueryType.INFINITE || type === QueryType.SUSPENSE_INFINITE)
        ? `InfiniteData<Awaited<ReturnType<${dataType}>>${infiniteParam}>`
        : `Awaited<ReturnType<${dataType}>>`;

  const queryOptionsFn = `export const ${queryOptionsFnName} = <TData = ${TData}, TError = ${errorType}>(${queryProps} ${queryArguments}) => {

${hookOptions}

  const queryKey =  ${
    queryKeyMutator
      ? `${queryKeyMutator.name}({ ${queryProperties} }${
          queryKeyMutator.hasSecondArg
            ? `, { url: \`${route}\`, queryOptions }`
            : ''
        });`
      : `${
          hasVueQueryV4 ? '' : 'queryOptions?.queryKey ?? '
        }${queryKeyFnName}(${queryKeyProperties});`
  }

  ${
    mutator?.isHook
      ? `const ${operationName} =  use${pascal(operationName)}Hook();`
      : ''
  }

    const queryFn: QueryFunction<${
      isZodModelStyle && response.definition.success
        ? dataType
        : `Awaited<ReturnType<${
            mutator?.isHook
              ? `ReturnType<typeof use${pascal(operationName)}Hook>`
              : `typeof ${operationName}`
          }>>`
    }${
      hasQueryV5 && hasInfiniteQueryParam
        ? `, QueryKey, ${queryParams?.schema.name}['${queryParam}']`
        : ''
    }> = (${queryFnArguments}) => ${operationName}(${httpFunctionProps}${
      httpFunctionProps ? ', ' : ''
    }${queryOptions});

      ${
        isVue(outputClient)
          ? vueUnRefParams(
              props.filter(
                (prop) => prop.type === GetterPropType.NAMED_PATH_PARAMS,
              ),
            )
          : ''
      }

      ${
        queryOptionsMutator
          ? `const customOptions = ${
              queryOptionsMutator.name
            }({...queryOptions, queryKey, queryFn}${
              queryOptionsMutator.hasSecondArg ? `, { ${queryProperties} }` : ''
            }${
              queryOptionsMutator.hasThirdArg ? `, { url: \`${route}\` }` : ''
            });`
          : ''
      }

   return  ${
     queryOptionsMutator
       ? 'customOptions'
       : `{ queryKey, queryFn, ${queryOptionsImp}}`
   } as ${queryOptionFnReturnType} ${
     isVue(outputClient)
       ? ''
       : `& { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`
   }
}`;

  const operationPrefix = hasSvelteQueryV4 ? 'create' : 'use';
  const optionalQueryClientArgument = hasQueryV5
    ? ', queryClient?: QueryClient'
    : '';

  const queryHookName = camel(`${operationPrefix}-${name}`);

  const overrideTypes = `
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${definedInitialDataQueryPropsDefinitions} ${definedInitialDataQueryArguments} ${optionalQueryClientArgument}\n  ): ${definedInitialDataReturnType}
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${queryPropDefinitions} ${undefinedInitialDataQueryArguments} ${optionalQueryClientArgument}\n  ): ${returnType}
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${queryPropDefinitions} ${queryArguments} ${optionalQueryClientArgument}\n  ): ${returnType}`;

  const prefetch = generatePrefetch({
    usePrefetch,
    type,
    useQuery,
    useInfinite,
    operationName,
    mutator,
    queryProps,
    dataType,
    errorType,
    hasSvelteQueryV6,
    queryArguments,
    queryOptionsVarName,
    queryOptionsFnName,
    queryProperties,
    isRequestOptions,
    doc,
  });

  const shouldGenerateInvalidate =
    useInvalidate &&
    (type === QueryType.QUERY ||
      type === QueryType.INFINITE ||
      (type === QueryType.SUSPENSE_QUERY && !useQuery) ||
      (type === QueryType.SUSPENSE_INFINITE && !useInfinite));
  const invalidateFnName = camel(`invalidate-${operationName}`);

  return `
${queryOptionsFn}

export type ${pascal(name)}QueryResult = NonNullable<${
    isZodModelStyle && response.definition.success
      ? dataType
      : `Awaited<ReturnType<${dataType}>>`
  }>
export type ${pascal(name)}QueryError = ${errorType}

${hasQueryV5 && OutputClient.REACT_QUERY === outputClient ? overrideTypes : ''}
${doc}
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${queryProps} ${queryArguments} ${optionalQueryClientArgument} \n ): ${returnType} {

  const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
    queryProperties ? ',' : ''
  }${isRequestOptions ? 'options' : 'queryOptions'})

  const ${queryResultVarName} = ${camel(`${operationPrefix}-${type}`)}(${
    hasSvelteQueryV6
      ? `() => ({ ...${queryOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''} })`
      : `${queryOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''}`
  }) as ${returnType};

  ${queryResultVarName}.queryKey = ${
    isVue(outputClient) ? `unref(${queryOptionsVarName})` : queryOptionsVarName
  }.queryKey ${isVue(outputClient) ? `as ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'}` : ''};

  return ${queryResultVarName};
}\n
${prefetch}
${
  shouldGenerateInvalidate
    ? `${doc}export const ${invalidateFnName} = async (\n queryClient: QueryClient, ${queryProps} options?: InvalidateOptions\n  ): Promise<QueryClient> => {

  await queryClient.invalidateQueries({ queryKey: ${queryKeyFnName}(${queryKeyProperties}) }, options);

  return queryClient;
}\n`
    : ''
}
`;
};

const generateQueryHook = async (
  verbOptions: GeneratorVerbOptions,
  { route, override: { operations = {} }, context, output }: GeneratorOptions,
  outputClient: OutputClient | OutputClientFunc,
) => {
  const {
    queryParams,
    operationName,
    body,
    props: _props,
    verb,
    params,
    override,
    mutator,
    response,
    operationId,
    summary,
    deprecated,
  } = verbOptions;
  let props = _props;
  if (isVue(outputClient)) {
    props = vueWrapTypeWithMaybeRef(_props);
  }

  // For zod model style, replace queryParams type in props with QueryParams type from zod file
  // This ensures we use LookupDealUrgencyListQueryParams instead of LookupDealUrgencyListParams
  if (context.output.modelStyle === ModelStyle.ZOD && queryParams) {
    // Replace Params with QueryParams (e.g., "LookupDealUrgencyListParams" -> "LookupDealUrgencyListQueryParams")
    const queryParamsTypeName = queryParams.schema.name.replace(
      /Params$/,
      'QueryParams',
    );
    props = props.map((prop: GetterProp) => {
      if (prop.type === GetterPropType.QUERY_PARAM) {
        const optionalMarker = prop.definition.includes('?') ? '?' : '';
        return {
          ...prop,
          definition: `params${optionalMarker}: ${queryParamsTypeName}`,
          implementation: `params${optionalMarker}: ${queryParamsTypeName}`,
        };
      }
      return prop;
    });
  }

  const query = override?.query;
  const isRequestOptions = override?.requestOptions !== false;
  const operationQueryOptions = operations[operationId]?.query;
  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const queryVersion = override.query.version ?? query?.version;

  const hasVueQueryV4 =
    OutputClient.VUE_QUERY === outputClient &&
    (!isVueQueryV3(context.output.packageJson) || queryVersion === 4);
  const hasSvelteQueryV4 =
    OutputClient.SVELTE_QUERY === outputClient &&
    (!isSvelteQueryV3(context.output.packageJson) || queryVersion === 4);
  const hasSvelteQueryV6 =
    OutputClient.SVELTE_QUERY === outputClient &&
    isSvelteQueryV6(context.output.packageJson);

  const hasQueryV5 =
    queryVersion === 5 ||
    isQueryV5(
      context.output.packageJson,
      outputClient as 'react-query' | 'vue-query' | 'svelte-query',
    );

  const hasQueryV5WithDataTagError =
    queryVersion === 5 ||
    isQueryV5WithDataTagError(
      context.output.packageJson,
      outputClient as 'react-query' | 'vue-query' | 'svelte-query',
    );

  const hasQueryV5WithInfiniteQueryOptionsError =
    queryVersion === 5 ||
    isQueryV5WithInfiniteQueryOptionsError(
      context.output.packageJson,
      outputClient as 'react-query' | 'vue-query' | 'svelte-query',
    );

  const httpClient = context.output.httpClient;
  const doc = jsDoc({ summary, deprecated });

  let implementation = '';
  let mutators;

  // Allows operationQueryOptions (which is the Orval config override for the operationId)
  // to override non-GET verbs
  const hasOperationQueryOption = !!(
    operationQueryOptions &&
    (operationQueryOptions.useQuery ||
      operationQueryOptions.useSuspenseQuery ||
      operationQueryOptions.useInfinite ||
      operationQueryOptions.useSuspenseInfiniteQuery)
  );

  let isQuery =
    (Verbs.GET === verb &&
      (override.query.useQuery ||
        override.query.useSuspenseQuery ||
        override.query.useInfinite ||
        override.query.useSuspenseInfiniteQuery)) ||
    hasOperationQueryOption;

  let isMutation = override.query.useMutation && verb !== Verbs.GET;

  if (operationQueryOptions?.useMutation !== undefined) {
    isMutation = operationQueryOptions.useMutation;
  }

  // If both query and mutation are true for a non-GET operation, prioritize query
  if (verb !== Verbs.GET && isQuery) {
    isMutation = false;
  }

  // If both query and mutation are true for a GET operation, prioritize mutation
  if (verb === Verbs.GET && isMutation) {
    isQuery = false;
  }

  if (isQuery) {
    const queryKeyMutator = query.queryKey
      ? await generateMutator({
          output,
          mutator: query.queryKey,
          name: `${operationName}QueryKey`,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

    const queryOptionsMutator = query.queryOptions
      ? await generateMutator({
          output,
          mutator: query.queryOptions,
          name: `${operationName}QueryOptions`,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

    const queryProperties = props
      .map((param) => {
        if (
          param.type === GetterPropType.NAMED_PATH_PARAMS &&
          !isVue(outputClient)
        )
          return param.destructured;
        return param.type === GetterPropType.BODY
          ? body.implementation
          : param.name;
      })
      .join(',');

    const queryKeyProperties = props
      .filter((prop) => prop.type !== GetterPropType.HEADER)
      .map((param) => {
        if (
          param.type === GetterPropType.NAMED_PATH_PARAMS &&
          !isVue(outputClient)
        )
          return param.destructured;
        return param.type === GetterPropType.BODY
          ? body.implementation
          : param.name;
      })
      .join(',');

    const queries = [
      ...(query?.useInfinite || operationQueryOptions?.useInfinite
        ? [
            {
              name: camel(`${operationName}-infinite`),
              options: query?.options,
              type: QueryType.INFINITE,
              queryParam: query?.useInfiniteQueryParam,
              queryKeyFnName: camel(`get-${operationName}-infinite-query-key`),
            },
          ]
        : []),
      ...(query?.useQuery || operationQueryOptions?.useQuery
        ? [
            {
              name: operationName,
              options: query?.options,
              type: QueryType.QUERY,
              queryKeyFnName: camel(`get-${operationName}-query-key`),
            },
          ]
        : []),
      ...(query?.useSuspenseQuery || operationQueryOptions?.useSuspenseQuery
        ? [
            {
              name: camel(`${operationName}-suspense`),
              options: query?.options,
              type: QueryType.SUSPENSE_QUERY,
              queryKeyFnName: camel(`get-${operationName}-query-key`),
            },
          ]
        : []),
      ...(query?.useSuspenseInfiniteQuery ||
      operationQueryOptions?.useSuspenseInfiniteQuery
        ? [
            {
              name: camel(`${operationName}-suspense-infinite`),
              options: query?.options,
              type: QueryType.SUSPENSE_INFINITE,
              queryParam: query?.useInfiniteQueryParam,
              queryKeyFnName: camel(`get-${operationName}-infinite-query-key`),
            },
          ]
        : []),
    ];

    // Convert "param: Type" to "param?: Type" for queryKey functions
    // to enable cache invalidation without type assertion
    const makeParamsOptional = (params: string) => {
      if (!params) return '';
      // Handle parameters with default values: "param?: Type = value" -> "param: Type = value" (remove optional marker)
      // Handle regular parameters: "param: Type" -> "param?: Type"
      return params.replaceAll(
        /(\w+)(\?)?:\s*([^=,}]*?)\s*(=\s*[^,}]*)?([,}]|$)/g,
        (match, paramName, optionalMarker, type, defaultValue, suffix) => {
          // If parameter has a default value, don't add '?' (it's already effectively optional)
          if (defaultValue) {
            return `${paramName}: ${type.trim()}${defaultValue}${suffix}`;
          }
          // Otherwise, make it optional
          return `${paramName}?: ${type.trim()}${suffix}`;
        },
      );
    };

    const uniqueQueryOptionsByKeys = queries.filter(
      (obj, index, self) =>
        index ===
        self.findIndex((t) => t.queryKeyFnName === obj.queryKeyFnName),
    );

    implementation += `
${
  queryKeyMutator
    ? ''
    : uniqueQueryOptionsByKeys.reduce((acc, queryOption) => {
        const queryKeyProps = makeParamsOptional(
          toObjectString(
            props.filter((prop) => prop.type !== GetterPropType.HEADER),
            'implementation',
          ),
        );

        const routeString =
          isVue(outputClient) || override.query.shouldSplitQueryKey
            ? getRouteAsArray(route) // Note: this is required for reactivity to work, we will lose it if route params are converted into string, only as array they will be tracked // TODO: add tests for this
            : `\`${route}\``;

        // Use operation ID as query key if enabled, otherwise use route string
        const queryKeyIdentifier = override.query.useOperationIdAsQueryKey
          ? `"${operationName}"`
          : routeString;

        // Note: do not unref() params in Vue - this will make key lose reactivity
        const queryKeyFn = `
${override.query.shouldExportQueryKey ? 'export ' : ''}const ${queryOption.queryKeyFnName} = (${queryKeyProps}) => {
    return [
    ${[
      queryOption.type === QueryType.INFINITE ||
      queryOption.type === QueryType.SUSPENSE_INFINITE
        ? `'infinite'`
        : '',
      queryKeyIdentifier,
      queryParams ? '...(params ? [params]: [])' : '',
      body.implementation,
    ]
      .filter((x) => !!x)
      .join(', ')}
    ] as const;
    }
`;
        return acc + queryKeyFn;
      }, '')
}`;

    implementation += `
    ${queries.reduce((acc, queryOption) => {
      return (
        acc +
        generateQueryImplementation({
          queryOption,
          operationName,
          queryProperties,
          queryKeyProperties,
          params,
          props,
          verbOptions,
          mutator,
          isRequestOptions,
          queryParams,
          response,
          outputClient,
          httpClient,
          isExactOptionalPropertyTypes,
          hasSignal: getHasSignal({
            overrideQuerySignal: override.query.signal,
            verb,
          }),
          queryOptionsMutator,
          queryKeyMutator,
          route,
          hasVueQueryV4,
          hasSvelteQueryV4,
          hasSvelteQueryV6,
          hasQueryV5,
          hasQueryV5WithDataTagError,
          hasQueryV5WithInfiniteQueryOptionsError,
          doc,
          usePrefetch: query.usePrefetch,
          useQuery: query.useQuery,
          useInfinite: query.useInfinite,
          useInvalidate: query.useInvalidate,
          output,
        })
      );
    }, '')}
`;

    mutators =
      queryOptionsMutator || queryKeyMutator
        ? [
            ...(queryOptionsMutator ? [queryOptionsMutator] : []),
            ...(queryKeyMutator ? [queryKeyMutator] : []),
          ]
        : undefined;
  }

  if (isMutation) {
    const mutationOptionsMutator = query.mutationOptions
      ? await generateMutator({
          output,
          mutator: query.mutationOptions,
          name: `${operationName}MutationOptions`,
          workspace: context.workspace,
          tsconfig: context.output.tsconfig,
        })
      : undefined;

    const definitions = props
      .map(({ definition, type }) =>
        type === GetterPropType.BODY
          ? mutator?.bodyTypeName
            ? `data: ${mutator.bodyTypeName}<${body.definition}>`
            : `data: ${body.definition}`
          : definition,
      )
      .join(';');

    const properties = props
      .map(({ name, type }) => (type === GetterPropType.BODY ? 'data' : name))
      .join(',');

    const errorType = getQueryErrorType(
      operationName,
      response,
      httpClient,
      mutator,
    );

    // For zod model style, use zod types instead of ReturnType
    // For others, use typeof for the function (we'll wrap it in Awaited<ReturnType<>> later)
    const dataType =
      output.modelStyle === ModelStyle.ZOD && response.definition.success
        ? response.definition.success
        : mutator?.isHook
          ? `ReturnType<typeof use${pascal(operationName)}Hook>`
          : `typeof ${operationName}`;

    const mutationOptionFnReturnType = getQueryOptionsDefinition({
      operationName,
      mutator,
      definitions,
      hasSvelteQueryV4,
      hasQueryV5,
      hasQueryV5WithInfiniteQueryOptionsError,
      isReturnType: true,
    });

    const mutationArguments = generateQueryArguments({
      operationName,
      definitions,
      mutator,
      isRequestOptions,
      hasSvelteQueryV4,
      hasQueryV5,
      hasQueryV5WithInfiniteQueryOptionsError,
      httpClient,
    });

    const mutationOptionsFnName = camel(
      mutationOptionsMutator || mutator?.isHook
        ? `use-${operationName}-mutationOptions`
        : `get-${operationName}-mutationOptions`,
    );

    const mutationOptionsVarName = isRequestOptions
      ? 'mutationOptions'
      : 'options';

    const hooksOptionImplementation = getHooksOptionImplementation(
      isRequestOptions,
      httpClient,
      camel(operationName),
      mutator,
    );

    const mutationOptionsFn = `export const ${mutationOptionsFnName} = <TError = ${errorType},
    TContext = unknown>(${mutationArguments}): ${mutationOptionFnReturnType} => {

${hooksOptionImplementation}

      ${
        mutator?.isHook
          ? `const ${operationName} =  use${pascal(operationName)}Hook()`
          : ''
      }


      const mutationFn: MutationFunction<${
        output.modelStyle === ModelStyle.ZOD && response.definition.success
          ? dataType
          : `Awaited<ReturnType<${dataType}>>`
      }, ${
        definitions ? `{${definitions}}` : 'void'
      }> = (${properties ? 'props' : ''}) => {
          ${properties ? `const {${properties}} = props ?? {};` : ''}

          return  ${operationName}(${properties}${
            properties ? ',' : ''
          }${getMutationRequestArgs(isRequestOptions, httpClient, mutator)})
        }

        ${
          mutationOptionsMutator
            ? `const customOptions = ${
                mutationOptionsMutator.name
              }({...mutationOptions, mutationFn}${
                mutationOptionsMutator.hasSecondArg
                  ? `, { url: \`${route.replaceAll('/${', '/{')}\` }`
                  : ''
              }${
                mutationOptionsMutator.hasThirdArg
                  ? `, { operationId: '${operationId}', operationName: '${operationName}' }`
                  : ''
              });`
            : ''
        }


  return  ${
    mutationOptionsMutator
      ? 'customOptions'
      : '{ mutationFn, ...mutationOptions }'
  }}`;

    const operationPrefix = hasSvelteQueryV4 ? 'create' : 'use';
    const optionalQueryClientArgument = hasQueryV5
      ? ', queryClient?: QueryClient'
      : '';

    implementation += `
${mutationOptionsFn}

    export type ${pascal(operationName)}MutationResult = NonNullable<${
      output.modelStyle === ModelStyle.ZOD && response.definition.success
        ? response.definition.success
        : `Awaited<ReturnType<${dataType}>>`
    }>
    ${
      body.definition
        ? `export type ${pascal(operationName)}MutationBody = ${
            mutator?.bodyTypeName
              ? `${mutator.bodyTypeName}<${body.definition}>`
              : body.definition
          }`
        : ''
    }
    export type ${pascal(operationName)}MutationError = ${errorType}

    ${doc}export const ${camel(
      `${operationPrefix}-${operationName}`,
    )} = <TError = ${errorType},
    TContext = unknown>(${mutationArguments} ${optionalQueryClientArgument})${generateMutatorReturnType(
      {
        outputClient,
        dataType,
        variableType: definitions ? `{${definitions}}` : 'void',
      },
    )} => {

      const ${mutationOptionsVarName} = ${mutationOptionsFnName}(${
        isRequestOptions ? 'options' : 'mutationOptions'
      });

      return ${operationPrefix}Mutation(${
        hasSvelteQueryV6
          ? `() => ({ ...${mutationOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''} })`
          : `${mutationOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''}`
      });
    }
    `;

    mutators = mutationOptionsMutator
      ? [...(mutators ?? []), mutationOptionsMutator]
      : mutators;
  }

  return {
    implementation,
    mutators,
  };
};

export const generateQueryHeader: ClientHeaderBuilder = (params) => {
  return `${
    params.hasAwaitedType
      ? ''
      : `type AwaitedInput<T> = PromiseLike<T> | T;\n
      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;\n\n`
  }
${
  params.isRequestOptions && params.isMutator
    ? `type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];\n\n`
    : ''
}
${getQueryHeader(params)}
`;
};

export const generateQuery: ClientBuilder = async (
  verbOptions,
  options,
  outputClient,
) => {
  // Generate function implementation first to update verbOptions with zod imports
  // This mutates verbOptions by setting specKey for zod imports
  const functionImplementation = generateQueryRequestFunction(
    verbOptions,
    options,
    isVue(outputClient),
    outputClient,
  );
  // Now collect imports after verbOptions has been updated with zod imports
  const imports = generateVerbImports(verbOptions);
  const { implementation: hookImplementation, mutators } =
    await generateQueryHook(verbOptions, options, outputClient);

  return {
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports,
    mutators,
  };
};

const dependenciesBuilder: Record<
  'react-query' | 'vue-query' | 'svelte-query',
  ClientDependenciesBuilder
> = {
  'react-query': getReactQueryDependencies,
  'vue-query': getVueQueryDependencies,
  'svelte-query': getSvelteQueryDependencies,
};

export const builder =
  ({
    type = 'react-query',
    options: queryOptions,
    output,
  }: {
    type?: 'react-query' | 'vue-query' | 'svelte-query';
    options?: QueryOptions;
    output?: NormalizedOutputOptions;
  } = {}) =>
  () => {
    const client: ClientBuilder = (verbOptions, options, outputClient) => {
      if (
        options.override.useNamedParameters &&
        (type === 'vue-query' || outputClient === 'vue-query')
      ) {
        throw new Error(
          `vue-query client does not support named parameters, and had broken reactivity previously, please set useNamedParameters to false; See for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686`,
        );
      }

      if (queryOptions) {
        const normalizedQueryOptions = normalizeQueryOptions(
          queryOptions,
          options.context.workspace,
        );
        verbOptions.override.query = mergeDeep(
          normalizedQueryOptions,
          verbOptions.override.query,
        );
        options.override.query = mergeDeep(
          normalizedQueryOptions,
          verbOptions.override.query,
        );
      }
      return generateQuery(verbOptions, options, outputClient, output);
    };

    // Wrap dependencies builder to add zod dependencies when modelStyle is ZOD
    const baseDependencies = dependenciesBuilder[type];
    const wrappedDependencies: ClientDependenciesBuilder = (
      hasGlobalMutator,
      hasParamsSerializerOptions,
      packageJson,
      httpClient,
      hasTagsMutator,
      override,
    ) => {
      const deps = baseDependencies(
        hasGlobalMutator,
        hasParamsSerializerOptions,
        packageJson,
        httpClient,
        hasTagsMutator,
        override,
      );
      // Add zod dependencies if modelStyle is ZOD
      if (output?.modelStyle === ModelStyle.ZOD) {
        return [...deps, ...getZodDependencies()];
      }
      return deps;
    };

    return {
      client: client,
      header: generateQueryHeader,
      dependencies: wrappedDependencies,
      ...(output?.modelStyle === ModelStyle.ZOD && {
        extraFiles: generateZodFiles,
      }),
    };
  };

export default builder;

// Helper function to get header
const getHeader = (
  option: false | ((info: InfoObject) => string | string[]),
  info: InfoObject,
): string => {
  if (!option) {
    return '';
  }

  const header = option(info);

  return Array.isArray(header) ? jsDoc({ description: header }) : header;
};

// Helper function to group verb options by tag
const getVerbOptionGroupByTag = (
  verbOptions: Record<string, GeneratorVerbOptions>,
) => {
  const grouped: Record<string, GeneratorVerbOptions[]> = {};

  for (const value of Object.values(verbOptions)) {
    const tag = value.tags[0];
    // this is not always false
    // TODO look into types
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!grouped[tag]) {
      grouped[tag] = [];
    }
    grouped[tag].push(value);
  }

  return grouped;
};

/**
 * Transform zod schema exports to support TypeScript 5.5 Isolated Declarations
 * Converts:
 *   export const schemaName = zod.object({...})
 * To:
 *   const schemaNameInternal = zod.object({...})
 *   export type TypeName = zod.infer<typeof schemaNameInternal>;
 *   export const schemaName: z.ZodType<TypeName> = schemaNameInternal;
 */
// Function to generate zod files for zod model style
const generateZodFiles: ClientExtraFilesBuilder = async (
  verbOptions: Record<string, GeneratorVerbOptions>,
  output: NormalizedOutputOptions,
  context: ContextSpecs,
) => {
  const { extension, dirname, filename } = getFileInfo(output.target);

  const header = getHeader(
    output.override.header,
    context.specs[context.specKey].info,
  );

  if (output.mode === 'tags' || output.mode === 'tags-split') {
    const groupByTags = getVerbOptionGroupByTag(verbOptions);

    const builderContexts = await Promise.all(
      Object.entries(groupByTags).map(async ([tag, verbs]) => {
        const zods = await Promise.all(
          verbs.map(async (verbOption) =>
            generateZod(
              verbOption,
              {
                route: verbOption.route,
                pathRoute: verbOption.pathRoute,
                override: output.override,
                context,
                mock: output.mock,
                output: output.target,
              },
              output.client,
            ),
          ),
        );

        if (zods.every((z) => z.implementation === '')) {
          return {
            content: '',
            path: '',
          };
        }

        const allMutators = [
          ...new Map(
            zods.flatMap((z) => z.mutators ?? []).map((m) => [m.name, m]),
          ).values(),
        ];

        const mutatorsImports = generateMutatorImports({
          mutators: allMutators,
        });

        let content = `${header}import { z, z as zod } from 'zod';\n${mutatorsImports}\n\n`;

        const zodPath =
          output.mode === 'tags'
            ? upath.join(dirname, `${kebab(tag)}.zod${extension}`)
            : upath.join(dirname, tag, tag + '.zod' + extension);

        const zodContentRaw = zods
          .map((zod) => zod.implementation)
          .join('\n\n');

        // Zod content is already in Isolated Declarations format from generateZodRoute
        content += zodContentRaw;

        // Add type aliases for queryParams (e.g., SearchPaymentMethodsListParams)
        const zodExports: string[] = [];
        const exportedTypeNames = new Set<string>();

        // Find exported types in Isolated Declarations format: export type TypeName = ...
        const typeExportRegex = /export type (\w+)\s*=\s*zod\.infer/g;
        let match;
        while ((match = typeExportRegex.exec(zodContentRaw)) !== null) {
          const typeName = match[1];

          // Check if this is a queryParams type that needs an alias
          if (typeName.endsWith('QueryParams')) {
            const paramsTypeName = typeName.replace(/QueryParams$/, 'Params');
            if (!exportedTypeNames.has(paramsTypeName)) {
              zodExports.push(`export type ${paramsTypeName} = ${typeName};`);
              exportedTypeNames.add(paramsTypeName);
            }
          }
        }

        if (zodExports.length > 0) {
          content += '\n\n' + zodExports.join('\n');
        }

        return {
          content,
          path: zodPath,
        };
      }),
    );

    return builderContexts.filter((context) => context.content !== '');
  }

  if (output.mode === 'split') {
    const zodFiles: ClientFileBuilder[] = [];

    for (const verbOption of Object.values(
      verbOptions,
    ) as GeneratorVerbOptions[]) {
      const zod = await generateZod(
        verbOption,
        {
          route: verbOption.route,
          pathRoute: verbOption.pathRoute,
          override: output.override,
          context,
          mock: output.mock,
          output: output.target,
        },
        output.client,
      );

      if (zod.implementation === '') {
        continue;
      }

      const mutatorsImports = generateMutatorImports({
        mutators: zod.mutators ?? [],
      });

      let content = `${header}import { z, z as zod } from 'zod';\n${mutatorsImports}\n\n`;

      // Zod implementation is already in Isolated Declarations format from generateZodRoute
      content += zod.implementation;

      // Add type aliases for queryParams (e.g., SearchPaymentMethodsListParams)
      const zodExports: string[] = [];
      const exportedTypeNames = new Set<string>();

      // Find exported types in Isolated Declarations format: export type TypeName = ...
      const typeExportRegex = /export type (\w+)\s*=\s*zod\.infer/g;
      let match;
      while ((match = typeExportRegex.exec(zod.implementation)) !== null) {
        const typeName = match[1];

        // Check if this is a queryParams type that needs an alias
        if (typeName.endsWith('QueryParams')) {
          const paramsTypeName = typeName.replace(/QueryParams$/, 'Params');
          if (!exportedTypeNames.has(paramsTypeName)) {
            zodExports.push(`export type ${paramsTypeName} = ${typeName};`);
            exportedTypeNames.add(paramsTypeName);
          }
        }
      }

      if (zodExports.length > 0) {
        content += '\n\n' + zodExports.join('\n');
      }

      const zodPath = upath.join(
        dirname,
        `${verbOption.operationName}.zod${extension}`,
      );

      zodFiles.push({
        content,
        path: zodPath,
      });
    }

    return zodFiles;
  }

  // single mode
  const zods = await Promise.all(
    (Object.values(verbOptions) as GeneratorVerbOptions[]).map(
      async (verbOption) =>
        generateZod(
          verbOption,
          {
            route: verbOption.route,
            pathRoute: verbOption.pathRoute,
            override: output.override,
            context,
            mock: output.mock,
            output: output.target,
          },
          output.client,
        ),
    ),
  );

  const allMutators = [
    ...new Map(
      zods.flatMap((z) => z.mutators ?? []).map((m) => [m.name, m]),
    ).values(),
  ];

  const mutatorsImports = generateMutatorImports({
    mutators: allMutators,
  });

  let content = `${header}import { z, z as zod } from 'zod';\n${mutatorsImports}\n\n`;

  const zodPath = upath.join(dirname, `${filename}.zod${extension}`);

  const zodContentRaw = zods.map((zod) => zod.implementation).join('\n\n');

  // Zod content is already in Isolated Declarations format from generateZodRoute
  content += zodContentRaw;

  // Add type aliases for queryParams (e.g., SearchPaymentMethodsListParams)
  const zodExports: string[] = [];
  const exportedTypeNames = new Set<string>();

  // Find exported types in Isolated Declarations format: export type TypeName = ...
  const typeExportRegex = /export type (\w+)\s*=\s*zod\.infer/g;
  let match;
  while ((match = typeExportRegex.exec(zodContentRaw)) !== null) {
    const typeName = match[1];

    // Check if this is a queryParams type that needs an alias
    if (typeName.endsWith('QueryParams')) {
      const paramsTypeName = typeName.replace(/QueryParams$/, 'Params');
      if (!exportedTypeNames.has(paramsTypeName)) {
        zodExports.push(`export type ${paramsTypeName} = ${typeName};`);
        exportedTypeNames.add(paramsTypeName);
      }
    }
  }

  if (zodExports.length > 0) {
    content += '\n\n' + zodExports.join('\n');
  }

  return [
    {
      content,
      path: zodPath,
    },
  ];
};

// React Query Zod Client Builder
