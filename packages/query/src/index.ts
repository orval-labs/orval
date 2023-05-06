import {
  camel,
  ClientBuilder,
  ClientDependenciesBuilder,
  ClientHeaderBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutator,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  GeneratorDependency,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
  GetterParams,
  GetterProps,
  GetterPropType,
  GetterResponse,
  isObject,
  isSyntheticDefaultImportsAllow,
  mergeDeep,
  OutputClient,
  OutputClientFunc,
  PackageJson,
  pascal,
  QueryOptions,
  stringify,
  toObjectString,
  Verbs,
  VERBS_WITH_BODY,
} from '@orval/core';
import omitBy from 'lodash.omitby';
import { normalizeQueryOptions } from './utils';

const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'axios',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
      { name: 'AxiosRequestConfig' },
      { name: 'AxiosResponse' },
      { name: 'AxiosError' },
    ],
    dependency: 'axios',
  },
];

const SVELTE_QUERY_DEPENDENCIES: GeneratorDependency[] = [
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
    ],
    dependency: '@sveltestack/svelte-query',
  },
];
const SVELTE_QUERY_V4_DEPENDENCIES: GeneratorDependency[] = [
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
    ],
    dependency: '@tanstack/svelte-query',
  },
];

// Vue persist reactivity
const updateVueRoute = (route: string): string =>
  (route ?? '').replaceAll(/\${(\w+)}/g, '${unref($1)}'); //

const isSvelteQueryV3 = (packageJson: PackageJson | undefined) => {
  const hasVueQuery =
    packageJson?.dependencies?.['@sveltestack/svelte-query'] ??
    packageJson?.devDependencies?.['@sveltestack/svelte-query'];
  const hasVueQueryV4 =
    packageJson?.dependencies?.['@tanstack/svelte-query'] ??
    packageJson?.devDependencies?.['@tanstack/svelte-query'];

  return !!hasVueQuery && !hasVueQueryV4;
};

export const getSvelteQueryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator,
  packageJson,
) => {
  const hasSvelteQueryV3 = isSvelteQueryV3(packageJson);

  return [
    ...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []),
    ...(hasSvelteQueryV3
      ? SVELTE_QUERY_DEPENDENCIES
      : SVELTE_QUERY_V4_DEPENDENCIES),
  ];
};

const REACT_QUERY_DEPENDENCIES: GeneratorDependency[] = [
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
      { name: 'UseQueryResult' },
      { name: 'UseInfiniteQueryResult' },
      { name: 'QueryKey' },
    ],
    dependency: 'react-query',
  },
];
const REACT_QUERY_V4_DEPENDENCIES: GeneratorDependency[] = [
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
      { name: 'UseQueryResult' },
      { name: 'UseInfiniteQueryResult' },
      { name: 'QueryKey' },
    ],
    dependency: '@tanstack/react-query',
  },
];

export const getReactQueryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator,
  packageJson,
) => {
  const hasReactQuery =
    packageJson?.dependencies?.['react-query'] ??
    packageJson?.devDependencies?.['react-query'];
  const hasReactQueryV4 =
    packageJson?.dependencies?.['@tanstack/react-query'] ??
    packageJson?.devDependencies?.['@tanstack/react-query'];

  return [
    ...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []),
    ...(hasReactQuery && !hasReactQueryV4
      ? REACT_QUERY_DEPENDENCIES
      : REACT_QUERY_V4_DEPENDENCIES),
  ];
};

const VUE_QUERY_DEPENDENCIES: GeneratorDependency[] = [
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
    ],
    dependency: 'vue-query/types',
  },
  {
    exports: [{ name: 'unref', values: true }],
    dependency: 'vue',
  },
  {
    exports: [{ name: 'UseQueryReturnType' }],
    dependency: 'vue-query/lib/vue/useBaseQuery',
  },
];

const VUE_QUERY_V4_DEPENDENCIES: GeneratorDependency[] = [
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
    ],
    dependency: '@tanstack/vue-query',
  },
  {
    exports: [{ name: 'unref', values: true }],
    dependency: 'vue',
  },
  {
    exports: [{ name: 'MaybeRef' }],
    dependency: '@tanstack/vue-query/build/lib/types',
  },
];

const isVueQueryV3 = (packageJson: PackageJson | undefined) => {
  const hasVueQuery =
    packageJson?.dependencies?.['vue-query'] ??
    packageJson?.devDependencies?.['vue-query'];
  const hasVueQueryV4 =
    packageJson?.dependencies?.['@tanstack/vue-query'] ??
    packageJson?.devDependencies?.['@tanstack/vue-query'];

  return !!hasVueQuery && !hasVueQueryV4;
};

export const getVueQueryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator: boolean,
  packageJson,
) => {
  const hasVueQueryV3 = isVueQueryV3(packageJson);

  return [
    ...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []),
    ...(hasVueQueryV3 ? VUE_QUERY_DEPENDENCIES : VUE_QUERY_V4_DEPENDENCIES),
  ];
};

const generateRequestOptionsArguments = ({
  isRequestOptions,
  hasSignal,
}: {
  isRequestOptions: boolean;
  hasSignal: boolean;
}) => {
  if (isRequestOptions) {
    return 'options?: AxiosRequestConfig\n';
  }

  return hasSignal ? 'signal?: AbortSignal\n' : '';
};

const generateQueryRequestFunction = (
  {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    formData,
    formUrlEncoded,
    override,
  }: GeneratorVerbOptions,
  { route: _route, context }: GeneratorOptions,
) => {
  // Vue - Unwrap path params
  const route: string = !!OutputClient.VUE_QUERY
    ? updateVueRoute(_route)
    : _route;
  const isRequestOptions = override.requestOptions !== false;
  const isFormData = override.formData !== false;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const hasSignal = !!override.query.signal;

  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.tsconfig,
  );
  const isExactOptionalPropertyTypes =
    !!context.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      headers,
      queryParams,
      response,
      verb,
      isFormData,
      isFormUrlEncoded,
      isBodyVerb,
      hasSignal,
      isExactOptionalPropertyTypes,
    });

    const propsImplementation =
      mutator?.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(`(\\w*):\\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    if (mutator.isHook) {
      return `export const use${pascal(operationName)}Hook = () => {
        const ${operationName} = ${mutator.name}<${
        response.definition.success || 'unknown'
      }>();

        return (\n    ${propsImplementation}\n ${
        isRequestOptions && mutator.hasSecondArg
          ? `options?: SecondParameter<ReturnType<typeof ${mutator.name}>>,`
          : ''
      }${
        !isBodyVerb && hasSignal ? 'signal?: AbortSignal\n' : ''
      }) => {${bodyForm}
        return ${operationName}(
          ${mutatorConfig},
          ${requestOptions});
        }
      }
    `;
    }

    return `export const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options?: SecondParameter<typeof ${mutator.name}>,`
        : ''
    }${
      !isBodyVerb && hasSignal ? 'signal?: AbortSignal\n' : ''
    }) => {${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions});
    }
  `;
  }

  const options = generateOptions({
    route,
    body,
    headers,
    queryParams,
    response,
    verb,
    requestOptions: override?.requestOptions,
    isFormData,
    isFormUrlEncoded,
    isExactOptionalPropertyTypes,
    hasSignal,
  });

  const optionsArgs = generateRequestOptionsArguments({
    isRequestOptions,
    hasSignal,
  });

  return `export const ${operationName} = (\n    ${toObjectString(
    props,
    'implementation',
  )} ${optionsArgs} ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${bodyForm}
    return axios${
      !isSyntheticDefaultImportsAllowed ? '.default' : ''
    }.${verb}(${options});
  }
`;
};

type QueryType = 'infiniteQuery' | 'query';

const QueryType = {
  INFINITE: 'infiniteQuery' as QueryType,
  QUERY: 'query' as QueryType,
};

const INFINITE_QUERY_PROPERTIES = ['getNextPageParam', 'getPreviousPageParam'];

const generateQueryOptions = ({
  params,
  options,
  type,
}: {
  params: GetterParams;
  options?: object | boolean;
  type: QueryType;
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
            INFINITE_QUERY_PROPERTIES.includes(key),
        ),
      )?.slice(1, -1)}`
    : '';

  if (!params.length) {
    if (options) {
      return `${queryConfig} ...queryOptions`;
    }

    return '...queryOptions';
  }

  return `${
    !isObject(options) || !options.hasOwnProperty('enabled')
      ? `enabled: !!(${params.map(({ name }) => name).join(' && ')}),`
      : ''
  }${queryConfig} ...queryOptions`;
};

const getQueryArgumentsRequestType = (mutator?: GeneratorMutator) => {
  if (!mutator) {
    return `axios?: AxiosRequestConfig`;
  }

  if (mutator.hasSecondArg && !mutator.isHook) {
    return `request?: SecondParameter<typeof ${mutator.name}>`;
  }

  if (mutator.hasSecondArg && mutator.isHook) {
    return `request?: SecondParameter<ReturnType<typeof ${mutator.name}>>`;
  }

  return '';
};

const getQueryOptionsDefinition = ({
  operationName,
  definitions,
  mutator,
  type,
  hasSvelteQueryV4,
}: {
  operationName: string;
  definitions: string;
  mutator?: GeneratorMutator;
  type?: QueryType;
  hasSvelteQueryV4: boolean;
}) => {
  const isMutatorHook = mutator?.isHook;
  const prefix = !hasSvelteQueryV4 ? 'Use' : 'Create';

  if (type) {
    return `${prefix}${pascal(type)}Options<Awaited<ReturnType<${
      isMutatorHook
        ? `ReturnType<typeof use${pascal(operationName)}Hook>`
        : `typeof ${operationName}`
    }>>, TError, TData>`;
  }

  return `${prefix}MutationOptions<Awaited<ReturnType<${
    isMutatorHook
      ? `ReturnType<typeof use${pascal(operationName)}Hook>`
      : `typeof ${operationName}`
  }>>, TError,${definitions ? `{${definitions}}` : 'TVariables'}, TContext>`;
};

const generateQueryArguments = ({
  operationName,
  definitions,
  mutator,
  isRequestOptions,
  type,
  hasSvelteQueryV4,
}: {
  operationName: string;
  definitions: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  type?: QueryType;
  hasSvelteQueryV4: boolean;
}) => {
  const definition = getQueryOptionsDefinition({
    operationName,
    definitions,
    mutator,
    type,
    hasSvelteQueryV4,
  });

  if (!isRequestOptions) {
    return `${type ? 'queryOptions' : 'mutationOptions'}?: ${definition}`;
  }

  const requestType = getQueryArgumentsRequestType(mutator);

  return `options?: { ${
    type ? 'query' : 'mutation'
  }?:${definition}, ${requestType}}\n`;
};

const generateQueryReturnType = ({
  outputClient,
  type,
  isMutatorHook,
  operationName,
  hasVueQueryV4,
  hasSvelteQueryV4,
}: {
  outputClient: OutputClient | OutputClientFunc;
  type: QueryType;
  isMutatorHook?: boolean;
  operationName: string;
  hasVueQueryV4: boolean;
  hasSvelteQueryV4: boolean;
}) => {
  switch (outputClient) {
    case OutputClient.SVELTE_QUERY: {
      if (!hasSvelteQueryV4) {
        return `Use${pascal(type)}StoreResult<Awaited<ReturnType<${
          isMutatorHook
            ? `ReturnType<typeof use${pascal(operationName)}Hook>`
            : `typeof ${operationName}`
        }>>, TError, TData, QueryKey> & { queryKey: QueryKey }`;
      }

      return `Create${pascal(
        type,
      )}Result<TData, TError> & { queryKey: QueryKey }`;
    }
    case OutputClient.VUE_QUERY: {
      if (!hasVueQueryV4) {
        return ` UseQueryReturnType<TData, TError, Use${pascal(
          type,
        )}Result<TData, TError>> & { queryKey: QueryKey }`;
      }

      if (type !== QueryType.INFINITE) {
        return `UseQueryReturnType<TData, TError> & { queryKey: QueryKey }`;
      }

      return `UseInfiniteQueryReturnType<TData, TError> & { queryKey: QueryKey }`;
    }
    case OutputClient.REACT_QUERY:
    default:
      return ` Use${pascal(
        type,
      )}Result<TData, TError> & { queryKey: QueryKey }`;
  }
};

const getQueryOptions = ({
  isRequestOptions,
  mutator,
  isExactOptionalPropertyTypes,
  hasSignal,
}: {
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
}) => {
  if (!mutator && isRequestOptions) {
    if (!hasSignal) {
      return 'axiosOptions';
    }
    return `{ ${
      isExactOptionalPropertyTypes ? '...(signal ? { signal } : {})' : 'signal'
    }, ...axiosOptions }`;
  }

  if (mutator?.hasSecondArg && isRequestOptions) {
    if (!hasSignal) {
      return 'requestOptions';
    }

    return 'requestOptions, signal';
  }

  if (hasSignal) {
    return 'signal';
  }

  return '';
};

const getHookOptions = ({
  isRequestOptions,
  mutator,
}: {
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
}) => {
  if (!isRequestOptions) {
    return '';
  }

  let value = 'const {query: queryOptions';

  if (!mutator) {
    value += ', axios: axiosOptions';
  }

  if (mutator?.hasSecondArg) {
    value += ', request: requestOptions';
  }

  value += '} = options ?? {};';

  return value;
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

const generateQueryImplementation = ({
  queryOption: { name, queryParam, options, type },
  operationName,
  queryKeyFnName,
  queryProperties,
  queryKeyProperties,
  params,
  props,
  mutator,
  queryOptionsMutator,
  queryKeyMutator,
  isRequestOptions,
  response,
  outputClient,
  isExactOptionalPropertyTypes,
  hasSignal,
  route,
  hasVueQueryV4,
  hasSvelteQueryV4,
}: {
  queryOption: {
    name: string;
    options?: object | boolean;
    type: QueryType;
    queryParam?: string;
  };
  isRequestOptions: boolean;
  operationName: string;
  queryKeyFnName: string;
  queryProperties: string;
  queryKeyProperties: string;
  params: GetterParams;
  props: GetterProps;
  response: GetterResponse;
  mutator?: GeneratorMutator;
  queryOptionsMutator?: GeneratorMutator;
  queryKeyMutator?: GeneratorMutator;
  outputClient: OutputClient | OutputClientFunc;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  route: string;
  hasVueQueryV4: boolean;
  hasSvelteQueryV4: boolean;
}) => {
  const queryProps = toObjectString(props, 'implementation');
  const httpFunctionProps = queryParam
    ? props
        .map(({ name }) =>
          name === 'params' ? `{ ${queryParam}: pageParam, ...params }` : name,
        )
        .join(',')
    : queryProperties;

  const returnType = generateQueryReturnType({
    outputClient,
    type,
    isMutatorHook: mutator?.isHook,
    operationName,
    hasVueQueryV4,
    hasSvelteQueryV4,
  });

  let errorType = `AxiosError<${response.definition.errors || 'unknown'}>`;

  if (mutator) {
    errorType = mutator.hasErrorType
      ? `${mutator.default ? pascal(operationName) : ''}ErrorType<${
          response.definition.errors || 'unknown'
        }>`
      : response.definition.errors || 'unknown';
  }

  const dataType = mutator?.isHook
    ? `ReturnType<typeof use${pascal(operationName)}Hook>`
    : `typeof ${operationName}`;

  const queryArguments = generateQueryArguments({
    operationName,
    definitions: '',
    mutator,
    isRequestOptions,
    type,
    hasSvelteQueryV4,
  });

  const queryOptions = getQueryOptions({
    isRequestOptions,
    isExactOptionalPropertyTypes,
    mutator,
    hasSignal,
  });

  const hookOptions = getHookOptions({
    isRequestOptions,
    mutator,
  });

  const queryFnArguments = getQueryFnArguments({
    hasQueryParam:
      !!queryParam && props.some(({ type }) => type === 'queryParam'),
    hasSignal,
  });

  const queryOptionFnReturnType = getQueryOptionsDefinition({
    operationName,
    definitions: '',
    mutator,
    type,
    hasSvelteQueryV4,
  });

  const queryOptionsImp = generateQueryOptions({
    params,
    options,
    type,
  });

  const queryOptionsFnName = camel(
    queryKeyMutator || queryOptionsMutator || mutator?.isHook
      ? `use-${name}-queryOptions`
      : `get-${name}-queryOptions`,
  );

  const queryOptionsVarName = isRequestOptions ? 'queryOptions' : 'options';

  const queryOptionsFn = `export const ${queryOptionsFnName} = <TData = Awaited<ReturnType<${dataType}>>, TError = ${errorType}>(${queryProps} ${queryArguments}): ${queryOptionFnReturnType} & { queryKey: QueryKey } => {
${hookOptions}

  const queryKey =  ${
    !queryKeyMutator
      ? `${
          !hasVueQueryV4 ? 'queryOptions?.queryKey ?? ' : ''
        }${queryKeyFnName}(${queryKeyProperties});`
      : `${queryKeyMutator.name}({ ${queryProperties} }${
          queryKeyMutator.hasSecondArg
            ? `, { url: \`${route}\`, queryOptions }`
            : ''
        });`
  }

  ${
    mutator?.isHook
      ? `const ${operationName} =  use${pascal(operationName)}Hook();`
      : ''
  }
  
    const queryFn: QueryFunction<Awaited<ReturnType<${
      mutator?.isHook
        ? `ReturnType<typeof use${pascal(operationName)}Hook>`
        : `typeof ${operationName}`
    }>>> = (${queryFnArguments}) => ${operationName}(${httpFunctionProps}${
    httpFunctionProps ? ', ' : ''
  }${queryOptions});
    
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
     !queryOptionsMutator
       ? `{ queryKey, queryFn, ${queryOptionsImp}}`
       : 'customOptions'
   }}`;

  const operationPrefix = hasSvelteQueryV4 ? 'create' : 'use';

  return `
${queryOptionsFn}

export type ${pascal(
    name,
  )}QueryResult = NonNullable<Awaited<ReturnType<${dataType}>>>
export type ${pascal(name)}QueryError = ${errorType}

export const ${camel(
    `${operationPrefix}-${name}`,
  )} = <TData = Awaited<ReturnType<${dataType}>>, TError = ${errorType}>(\n ${queryProps} ${queryArguments}\n  ): ${returnType} => {

  const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
    queryProperties ? ',' : ''
  }${isRequestOptions ? 'options' : 'queryOptions'})

  const query = ${camel(
    `${operationPrefix}-${type}`,
  )}(${queryOptionsVarName}) as ${returnType};

  query.queryKey = ${queryOptionsVarName}.queryKey;

  return query;
}\n`;
};

const generateQueryHook = async (
  {
    queryParams,
    operationName,
    body,
    props,
    verb,
    params,
    override,
    mutator,
    response,
    operationId,
  }: GeneratorVerbOptions,
  {
    route: _route,
    override: { operations = {} },
    context,
    output,
  }: GeneratorOptions,
  outputClient: OutputClient | OutputClientFunc,
) => {
  // Vue - Unwrap path params
  const route: string = !!OutputClient.VUE_QUERY
    ? updateVueRoute(_route)
    : _route;
  const query = override?.query;
  const isRequestOptions = override?.requestOptions !== false;
  const operationQueryOptions = operations[operationId]?.query;
  const isExactOptionalPropertyTypes =
    !!context.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

  const hasVueQueryV4 =
    OutputClient.VUE_QUERY === outputClient &&
    !isVueQueryV3(context.packageJson);
  const hasSvelteQueryV4 =
    OutputClient.SVELTE_QUERY === outputClient &&
    !isSvelteQueryV3(context.packageJson);

  if (
    verb === Verbs.GET ||
    operationQueryOptions?.useInfinite ||
    operationQueryOptions?.useQuery
  ) {
    const queryKeyMutator = query.queryKey
      ? await generateMutator({
          output,
          mutator: query.queryKey,
          name: `${operationName}QueryKey`,
          workspace: context.workspace,
          tsconfig: context.tsconfig,
        })
      : undefined;

    const queryOptionsMutator = query.queryOptions
      ? await generateMutator({
          output,
          mutator: query.queryOptions,
          name: `${operationName}QueryOptions`,
          workspace: context.workspace,
          tsconfig: context.tsconfig,
        })
      : undefined;

    const queryProperties = props
      .map(({ name, type }) =>
        type === GetterPropType.BODY ? body.implementation : name,
      )
      .join(',');

    const queryKeyProperties = props
      .filter((prop) => prop.type !== GetterPropType.HEADER)
      .map(({ name, type }) =>
        type === GetterPropType.BODY ? body.implementation : name,
      )
      .join(',');

    const queries = [
      ...(query?.useInfinite
        ? [
            {
              name: camel(`${operationName}-infinite`),
              options: query?.options,
              type: QueryType.INFINITE,
              queryParam: query?.useInfiniteQueryParam,
            },
          ]
        : []),
      ...((!query?.useQuery && !query?.useInfinite) || query?.useQuery
        ? [
            {
              name: operationName,
              options: query?.options,
              type: QueryType.QUERY,
            },
          ]
        : []),
    ];

    const queryKeyFnName = camel(`get-${operationName}-queryKey`);
    const queryKeyProps = toObjectString(
      props.filter((prop) => prop.type !== GetterPropType.HEADER),
      'implementation',
    );

    const queryKeyFn = `export const ${queryKeyFnName} = (${queryKeyProps}) => [\`${route}\`${
      queryParams ? ', ...(params ? [params]: [])' : ''
    }${body.implementation ? `, ${body.implementation}` : ''}] as const;`;

    const implementation = `${!queryKeyMutator ? queryKeyFn : ''}
  

    ${queries.reduce(
      (acc, queryOption) =>
        acc +
        generateQueryImplementation({
          queryOption,
          operationName,
          queryKeyFnName,
          queryProperties,
          queryKeyProperties,
          params,
          props,
          mutator,
          isRequestOptions,
          response,
          outputClient,
          isExactOptionalPropertyTypes,
          hasSignal: !!query.signal,
          queryOptionsMutator,
          queryKeyMutator,
          route,
          hasVueQueryV4,
          hasSvelteQueryV4,
        }),
      '',
    )}
`;

    return {
      implementation,
      mutators:
        queryOptionsMutator || queryKeyMutator
          ? [
              ...(queryOptionsMutator ? [queryOptionsMutator] : []),
              ...(queryKeyMutator ? [queryKeyMutator] : []),
            ]
          : undefined,
    };
  }

  const mutationOptionsMutator = query.mutationOptions
    ? await generateMutator({
        output,
        mutator: query.mutationOptions,
        name: `${operationName}MutationOptions`,
        workspace: context.workspace,
        tsconfig: context.tsconfig,
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

  let errorType = `AxiosError<${response.definition.errors || 'unknown'}>`;

  if (mutator) {
    errorType = mutator.hasErrorType
      ? `${mutator.default ? pascal(operationName) : ''}ErrorType<${
          response.definition.errors || 'unknown'
        }>`
      : response.definition.errors || 'unknown';
  }

  const dataType = mutator?.isHook
    ? `ReturnType<typeof use${pascal(operationName)}Hook>`
    : `typeof ${operationName}`;

  const mutationOptionFnReturnType = getQueryOptionsDefinition({
    operationName,
    definitions,
    mutator,
    hasSvelteQueryV4,
  });

  const mutationArguments = generateQueryArguments({
    operationName,
    definitions,
    mutator,
    isRequestOptions,
    hasSvelteQueryV4,
  });

  const mutationOptionsFnName = camel(
    mutationOptionsMutator || mutator?.isHook
      ? `use-${operationName}-mutationOptions`
      : `get-${operationName}-mutationOptions`,
  );

  const mutationOptionsVarName = isRequestOptions
    ? 'mutationOptions'
    : 'options';

  const mutationOptionsFn = `export const ${mutationOptionsFnName} = <TError = ${errorType},
    ${!definitions ? `TVariables = void,` : ''}
    TContext = unknown>(${mutationArguments}): ${mutationOptionFnReturnType} => {
 ${
   isRequestOptions
     ? `const {mutation: mutationOptions${
         !mutator
           ? `, axios: axiosOptions`
           : mutator?.hasSecondArg
           ? ', request: requestOptions'
           : ''
       }} = options ?? {};`
     : ''
 }

      ${
        mutator?.isHook
          ? `const ${operationName} =  use${pascal(operationName)}Hook()`
          : ''
      }


      const mutationFn: MutationFunction<Awaited<ReturnType<${dataType}>>, ${
    definitions ? `{${definitions}}` : 'TVariables'
  }> = (${properties ? 'props' : ''}) => {
          ${properties ? `const {${properties}} = props ?? {};` : ''}

          return  ${operationName}(${properties}${properties ? ',' : ''}${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : mutator?.hasSecondArg
        ? 'requestOptions'
        : ''
      : ''
  })
        }

        ${
          mutationOptionsMutator
            ? `const customOptions = ${
                mutationOptionsMutator.name
              }({...mutationOptions, mutationFn}${
                mutationOptionsMutator.hasThirdArg
                  ? `, { url: \`${route}\` }`
                  : ''
              });`
            : ''
        }

 
   return  ${
     !mutationOptionsMutator
       ? '{ mutationFn, ...mutationOptions }'
       : 'customOptions'
   }}`;

  const operationPrefix = hasSvelteQueryV4 ? 'create' : 'use';

  const implementation = `
${mutationOptionsFn}

    export type ${pascal(
      operationName,
    )}MutationResult = NonNullable<Awaited<ReturnType<${dataType}>>>
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

    export const ${camel(
      `${operationPrefix}-${operationName}`,
    )} = <TError = ${errorType},
    ${!definitions ? `TVariables = void,` : ''}
    TContext = unknown>(${mutationArguments}) => {
    
      const ${mutationOptionsVarName} = ${mutationOptionsFnName}(${
    isRequestOptions ? 'options' : 'mutationOptions'
  });
     
      return ${operationPrefix}Mutation(${mutationOptionsVarName});
    }
    `;

  return {
    implementation,
    mutators: mutationOptionsMutator ? [mutationOptionsMutator] : undefined,
  };
};

export const generateQueryHeader: ClientHeaderBuilder = ({
  isRequestOptions,
  isMutator,
  hasAwaitedType,
}) => {
  return `${
    !hasAwaitedType
      ? `type AwaitedInput<T> = PromiseLike<T> | T;\n
      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;\n\n`
      : ''
  }
${
  isRequestOptions && isMutator
    ? `// eslint-disable-next-line
  type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;\n\n`
    : ''
}`;
};

export const generateQuery: ClientBuilder = async (
  verbOptions,
  options,
  outputClient,
) => {
  const imports = generateVerbImports(verbOptions);
  const functionImplementation = generateQueryRequestFunction(
    verbOptions,
    options,
  );
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
  }: {
    type?: 'react-query' | 'vue-query' | 'svelte-query';
    options?: QueryOptions;
  } = {}) =>
  () => {
    const client: ClientBuilder = (verbOptions, options, outputClient) => {
      if (queryOptions) {
        const normarlizeQueryOptions = normalizeQueryOptions(
          queryOptions,
          options.context.workspace,
        );
        verbOptions.override.query = mergeDeep(
          normarlizeQueryOptions,
          verbOptions.override.query,
        );
        options.override.query = mergeDeep(
          normarlizeQueryOptions,
          verbOptions.override.query,
        );
      }
      return generateQuery(verbOptions, options, outputClient);
    };

    return {
      client: client,
      header: generateQueryHeader,
      dependencies: dependenciesBuilder[type],
    };
  };

export default builder;
