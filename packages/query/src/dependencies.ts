import {
  type ClientDependenciesBuilder,
  compareVersions,
  type GeneratorDependency,
  OutputHttpClient,
  type PackageJson,
} from '@orval/core';

import { ANGULAR_HTTP_DEPENDENCIES, AXIOS_DEPENDENCIES } from './client';

export const REACT_DEPENDENCIES: GeneratorDependency[] = [
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

export const PARAMS_SERIALIZER_DEPENDENCIES: GeneratorDependency[] = [
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
      { name: 'useQueryClient', values: true },
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
      { name: 'useQueryClient', values: true },
      { name: 'CreateQueryOptions' },
      {
        name: 'CreateInfiniteQueryOptions',
      },
      { name: 'MutationFunctionContext' },
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

export const isSvelteQueryV3 = (packageJson: PackageJson | undefined) => {
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

export const isSvelteQueryV6 = (packageJson: PackageJson | undefined) => {
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

  const queryVersion = override?.query.version;
  const useReactQueryV3 =
    queryVersion === undefined
      ? hasReactQuery && !hasReactQueryV4
      : queryVersion <= 3;

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

const getSolidQueryImports = (
  prefix: 'use' | 'create',
): GeneratorDependency[] => {
  const capitalized = prefix === 'use' ? 'Use' : 'Create';
  return [
    {
      exports: [
        { name: `${prefix}Query`, values: true },
        { name: `${prefix}InfiniteQuery`, values: true },
        { name: `${prefix}Mutation`, values: true },
        { name: `${capitalized}QueryOptions` },
        { name: `${capitalized}InfiniteQueryOptions` },
        { name: `${capitalized}MutationOptions` },
        { name: 'QueryFunction' },
        { name: 'MutationFunction' },
        { name: `${capitalized}QueryResult` },
        { name: `${capitalized}InfiniteQueryResult` },
        { name: 'QueryKey' },
        { name: 'InfiniteData' },
        { name: `${capitalized}MutationResult` },
        { name: 'DataTag' },
        { name: 'QueryClient' },
        { name: 'InvalidateOptions' },
      ],
      dependency: '@tanstack/solid-query',
    },
  ];
};

const ANGULAR_QUERY_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'injectQuery', values: true },
      { name: 'injectInfiniteQuery', values: true },
      { name: 'injectMutation', values: true },
      { name: 'InjectQueryOptions' },
      { name: 'InjectMutationOptions' },
      { name: 'CreateQueryOptions' },
      { name: 'CreateInfiniteQueryOptions' },
      { name: 'CreateMutationOptions' },
      { name: 'QueryFunction' },
      { name: 'MutationFunction' },
      { name: 'QueryKey' },
      { name: 'CreateQueryResult' },
      { name: 'CreateInfiniteQueryResult' },
      { name: 'InfiniteData' },
      { name: 'CreateMutationResult' },
      { name: 'DataTag' },
      { name: 'QueryClient', values: true },
      { name: 'InvalidateOptions' },
      { name: 'MutationFunctionContext' },
    ],
    dependency: '@tanstack/angular-query-experimental',
  },
  {
    exports: [
      { name: 'inject', values: true },
      { name: 'Signal' },
      { name: 'computed', values: true },
    ],
    dependency: '@angular/core',
  },
];

export const isVueQueryV3 = (packageJson: PackageJson | undefined) => {
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

export const getSolidQueryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator: boolean,
  hasParamsSerializerOptions: boolean,
  packageJson,
  httpClient?: OutputHttpClient,
) => {
  return [
    ...(!hasGlobalMutator && httpClient === OutputHttpClient.AXIOS
      ? AXIOS_DEPENDENCIES
      : []),
    ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
    ...getSolidQueryImports(
      isSolidQueryWithUsePrefix(packageJson) ? 'use' : 'create',
    ),
  ];
};

export const getAngularQueryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator: boolean,
  hasParamsSerializerOptions: boolean,
  packageJson,
  httpClient?: OutputHttpClient,
) => {
  // Always use Angular HTTP dependencies for Angular httpClient
  // Previously skipped for mutators, but we now inject http everywhere
  const useAngularHttp = httpClient === OutputHttpClient.ANGULAR;
  const useAxios = !hasGlobalMutator && httpClient === OutputHttpClient.AXIOS;

  return [
    ...(useAngularHttp ? ANGULAR_HTTP_DEPENDENCIES : []),
    ...(useAxios ? AXIOS_DEPENDENCIES : []),
    ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
    ...ANGULAR_QUERY_DEPENDENCIES,
  ];
};

export const isQueryV5 = (
  packageJson: PackageJson | undefined,
  queryClient:
    | 'react-query'
    | 'vue-query'
    | 'svelte-query'
    | 'angular-query'
    | 'solid-query',
) => {
  // Angular Query is v5 only
  if (queryClient === 'angular-query') {
    return true;
  }

  const version = getPackageByQueryClient(packageJson, queryClient);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '5.0.0');
};

const isQueryV6 = (
  packageJson: PackageJson | undefined,
  queryClient: 'react-query' | 'vue-query' | 'svelte-query' | 'solid-query',
) => {
  const version = getPackageByQueryClient(packageJson, queryClient);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '6.0.0');
};

export const isQueryV5WithDataTagError = (
  packageJson: PackageJson | undefined,
  queryClient:
    | 'react-query'
    | 'vue-query'
    | 'svelte-query'
    | 'angular-query'
    | 'solid-query',
) => {
  // Angular Query is v5 only and supports DataTag
  if (queryClient === 'angular-query') {
    return true;
  }

  const version = getPackageByQueryClient(packageJson, queryClient);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '5.62.0');
};

export const isQueryV5WithInfiniteQueryOptionsError = (
  packageJson: PackageJson | undefined,
  queryClient:
    | 'react-query'
    | 'vue-query'
    | 'svelte-query'
    | 'angular-query'
    | 'solid-query',
) => {
  // Angular Query is v5 only and supports infinite query options
  if (queryClient === 'angular-query') {
    return true;
  }

  const version = getPackageByQueryClient(packageJson, queryClient);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '5.80.0');
};

export const isSolidQueryWithUsePrefix = (
  packageJson: PackageJson | undefined,
) => {
  const version = getPackageByQueryClient(packageJson, 'solid-query');

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  // https://github.com/TanStack/query/blob/v5.71.5/packages/solid-query/src/index.ts
  return compareVersions(withoutRc, '5.71.5');
};

const getPackageByQueryClient = (
  packageJson: PackageJson | undefined,
  queryClient:
    | 'react-query'
    | 'vue-query'
    | 'svelte-query'
    | 'angular-query'
    | 'solid-query',
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
    case 'angular-query': {
      return (
        packageJson?.dependencies?.['@tanstack/angular-query-experimental'] ??
        packageJson?.devDependencies?.[
          '@tanstack/angular-query-experimental'
        ] ??
        packageJson?.peerDependencies?.['@tanstack/angular-query-experimental']
      );
    }
    case 'solid-query': {
      return (
        packageJson?.dependencies?.['@tanstack/solid-query'] ??
        packageJson?.devDependencies?.['@tanstack/solid-query'] ??
        packageJson?.peerDependencies?.['@tanstack/solid-query']
      );
    }
  }
};
