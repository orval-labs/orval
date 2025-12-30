import {
  camel,
  generateMutator,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  getRouteAsArray,
  type GetterParams,
  type GetterProp,
  type GetterProps,
  GetterPropType,
  type GetterQueryParam,
  type GetterResponse,
  jsDoc,
  OutputClient,
  type OutputClientFunc,
  OutputHttpClient,
  pascal,
  toObjectString,
  Verbs,
} from '@orval/core';

import {
  getHookOptions,
  getHttpFunctionQueryProps,
  getQueryErrorType,
  getQueryOptions,
} from './client';
import {
  isQueryV5,
  isQueryV5WithDataTagError,
  isQueryV5WithInfiniteQueryOptionsError,
  isSvelteQueryV3,
  isSvelteQueryV6,
  isVueQueryV3,
} from './dependencies';
import { generateMutationHook } from './mutation-generator';
import {
  generateQueryArguments,
  generateQueryOptions,
  getQueryOptionsDefinition,
  isSuspenseQuery,
  QueryType,
} from './query-options';
import {
  generateQueryReturnType,
  getQueryFnArguments,
  getQueryReturnStatement,
} from './return-types';
import {
  getHasSignal,
  getQueryTypeForFramework,
  isAngular,
  isVue,
  vueUnRefParams,
  vueWrapTypeWithMaybeRef,
} from './utils';

/**
 * Get framework-aware prefix for hook names and type definitions
 * @param hasSvelteQueryV4 - Whether using Svelte Query v4
 * @param isAngularClient - Whether using Angular client
 * @param capitalize - Whether to capitalize the prefix (for type definitions)
 * @returns The appropriate prefix string
 */
export const getFrameworkPrefix = (
  hasSvelteQueryV4: boolean,
  isAngularClient: boolean,
  capitalize = false,
): string => {
  let prefix: string;

  if (hasSvelteQueryV4) {
    prefix = 'create';
  } else if (isAngularClient) {
    prefix = 'inject';
  } else {
    prefix = 'use';
  }

  return capitalize ? prefix.charAt(0).toUpperCase() + prefix.slice(1) : prefix;
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
  type: (typeof QueryType)[keyof typeof QueryType];
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
}: {
  queryOption: {
    name: string;
    options?: object | boolean;
    type: (typeof QueryType)[keyof typeof QueryType];
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
}) => {
  const queryPropDefinitions = toObjectString(props, 'definition');
  const definedInitialDataQueryPropsDefinitions = toObjectString(
    props.map((prop) => {
      const regex = new RegExp(String.raw`^${prop.name}\s*\?:`);

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

  const isAngularHttp =
    isAngular(outputClient) || httpClient === OutputHttpClient.ANGULAR;

  let httpFunctionProps = queryParam
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
        isAngularHttp,
      );

  // For Angular with infinite queries, we need to prefix with http
  if (queryParam && isAngularHttp) {
    httpFunctionProps = httpFunctionProps
      ? `http, ${httpFunctionProps}`
      : 'http';
  }

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

  const dataType = mutator?.isHook
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
    isAngularClient: isAngular(outputClient),
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
    isAngularClient: isAngular(outputClient),
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
    isAngularClient: isAngular(outputClient),
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
    isAngularClient: isAngular(outputClient),
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
  const TData =
    hasQueryV5 &&
    (type === QueryType.INFINITE || type === QueryType.SUSPENSE_INFINITE)
      ? `InfiniteData<Awaited<ReturnType<${dataType}>>${infiniteParam}>`
      : `Awaited<ReturnType<${dataType}>>`;

  const queryOptionsFn = `export const ${queryOptionsFnName} = <TData = ${TData}, TError = ${errorType}>(${queryProps} ${queryArguments}) => {

${hookOptions}
${isAngularHttp ? '  const http = inject(HttpClient);' : ''}

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

    const queryFn: QueryFunction<Awaited<ReturnType<${
      mutator?.isHook
        ? `ReturnType<typeof use${pascal(operationName)}Hook>`
        : `typeof ${operationName}`
    }>>${
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
     isVue(outputClient) || isAngular(outputClient)
       ? ''
       : `& { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`
   }
}`;
  const operationPrefix = getFrameworkPrefix(
    hasSvelteQueryV4,
    isAngular(outputClient),
  );
  const optionalQueryClientArgument =
    hasQueryV5 && !isAngular(outputClient) ? ', queryClient?: QueryClient' : '';

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
  const invalidateFnName = camel(`invalidate-${name}`);

  return `
${queryOptionsFn}

export type ${pascal(
    name,
  )}QueryResult = NonNullable<Awaited<ReturnType<${dataType}>>>
export type ${pascal(name)}QueryError = ${errorType}

${hasQueryV5 && OutputClient.REACT_QUERY === outputClient ? overrideTypes : ''}
${doc}
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${queryProps} ${queryArguments} ${optionalQueryClientArgument} \n ): ${returnType} {

  const ${queryOptionsVarName} = ${queryOptionsFnName}(${queryProperties}${
    queryProperties ? ',' : ''
  }${isRequestOptions ? 'options' : 'queryOptions'})

  const ${queryResultVarName} = ${camel(
    `${operationPrefix}-${isAngular(outputClient) || hasSvelteQueryV4 ? getQueryTypeForFramework(type) : type}`,
  )}(${
    isAngular(outputClient)
      ? `() => ${queryOptionsVarName}`
      : hasSvelteQueryV6
        ? `() => ({ ...${queryOptionsVarName}${optionalQueryClientArgument ? ', queryClient' : ''} })`
        : `${queryOptionsVarName}${!isAngular(outputClient) && optionalQueryClientArgument ? ', queryClient' : ''}`
  }) as ${returnType};

  ${getQueryReturnStatement({
    outputClient,
    hasSvelteQueryV4,
    hasSvelteQueryV6,
    hasQueryV5,
    hasQueryV5WithDataTagError,
    queryResultVarName,
    queryOptionsVarName,
  })}
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

export const generateQueryHook = async (
  {
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
  }: GeneratorVerbOptions,
  { route, override: { operations }, context, output }: GeneratorOptions,
  outputClient: OutputClient | OutputClientFunc,
) => {
  let props = _props;
  if (isVue(outputClient)) {
    props = vueWrapTypeWithMaybeRef(_props);
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
      outputClient as
        | 'react-query'
        | 'vue-query'
        | 'svelte-query'
        | 'angular-query',
    );

  const hasQueryV5WithDataTagError =
    queryVersion === 5 ||
    isQueryV5WithDataTagError(
      context.output.packageJson,
      outputClient as
        | 'react-query'
        | 'vue-query'
        | 'svelte-query'
        | 'angular-query',
    );

  const hasQueryV5WithInfiniteQueryOptionsError =
    queryVersion === 5 ||
    isQueryV5WithInfiniteQueryOptionsError(
      context.output.packageJson,
      outputClient as
        | 'react-query'
        | 'vue-query'
        | 'svelte-query'
        | 'angular-query',
    );

  const httpClient = context.output.httpClient;
  const isAngularHttp =
    isAngular(outputClient) || httpClient === OutputHttpClient.ANGULAR;
  const doc = jsDoc({ summary, deprecated });

  let implementation = '';
  let mutators: GeneratorMutator[] | undefined;

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

        // Use all params in query key when useOperationIdAsQueryKey=true, otherwise use only query param
        // All params sorted by required first
        const queryKeyParams = props
          .filter((p) =>
            override.query.useOperationIdAsQueryKey
              ? true
              : p.type === GetterPropType.QUERY_PARAM,
          )
          .toSorted((a) => (a.required ? -1 : 1))
          .map((p) => `...(${p.name} ? [${p.name}] : [])`)
          .join(', ');

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
      queryKeyParams,
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
    const mutationResult = await generateMutationHook({
      verbOptions: {
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
        summary,
        deprecated,
      },
      options: { route, override: { operations }, context, output },
      outputClient,
      hasQueryV5,
      hasQueryV5WithInfiniteQueryOptionsError,
      hasSvelteQueryV4,
      hasSvelteQueryV6,
      isRequestOptions,
      httpClient,
      doc,
      isAngularHttp,
    });

    implementation += mutationResult.implementation;
    mutators = mutationResult.mutators
      ? [...(mutators ?? []), ...mutationResult.mutators]
      : mutators;
  }

  return {
    implementation,
    mutators,
  };
};
