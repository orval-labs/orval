import {
  camel,
  generateMutator,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GetterParams,
  type GetterProp,
  type GetterProps,
  GetterPropType,
  type GetterQueryParam,
  type GetterResponse,
  jsDoc,
  type OutputClient,
  type OutputClientFunc,
  type OutputHttpClient,
  pascal,
  toObjectString,
  Verbs,
} from '@orval/core';

import { getHookOptions, getQueryErrorType, getQueryOptions } from './client';
import type { FrameworkAdapter } from './framework-adapter';
import { generateMutationHook } from './mutation-generator';
import {
  generateQueryOptions,
  getQueryOptionsDefinition,
  QueryType,
} from './query-options';
import { getHasSignal } from './utils';

const getQueryFnArguments = ({
  hasQueryParam,
  hasSignal,
  hasSignalParam = false,
}: {
  hasQueryParam: boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
}) => {
  if (!hasQueryParam && !hasSignal) {
    return '';
  }

  // Rename AbortSignal if API has a param named "signal" to avoid conflict
  const signalDestructure = hasSignalParam ? 'signal: querySignal' : 'signal';

  if (hasQueryParam) {
    if (hasSignal) {
      return `{ ${signalDestructure}, pageParam }`;
    }

    return '{ pageParam }';
  }

  return `{ ${signalDestructure} }`;
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

  await queryClient.${prefetchFnName}(${queryOptionsVarName});

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
  httpClient,
  isExactOptionalPropertyTypes,
  hasSignal,
  route,
  doc,
  usePrefetch,
  useQuery,
  useInfinite,
  useInvalidate,
  adapter,
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
  httpClient: OutputHttpClient;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  route: string;
  doc?: string;
  usePrefetch?: boolean;
  useQuery?: boolean;
  useInfinite?: boolean;
  useInvalidate?: boolean;
  adapter: FrameworkAdapter;
}) => {
  const {
    hasQueryV5,
    hasQueryV5WithDataTagError,
    hasQueryV5WithInfiniteQueryOptionsError,
  } = adapter;

  // Check if API has a param named "signal" to avoid conflict with AbortSignal
  const hasSignalParam = props.some(
    (prop: GetterProp) => prop.name === 'signal',
  );

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

  const httpFunctionProps = queryParam
    ? adapter.getInfiniteQueryHttpProps(props, queryParam, !!mutator)
    : adapter.getHttpFunctionQueryProps(queryProperties, httpClient, !!mutator);

  const definedInitialDataReturnType = adapter.getQueryReturnType({
    type,
    isMutatorHook: mutator?.isHook,
    operationName,
    hasQueryV5,
    hasQueryV5WithDataTagError,
    isInitialDataDefined: true,
  });
  const returnType = adapter.getQueryReturnType({
    type,
    isMutatorHook: mutator?.isHook,
    operationName,
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

  const definedInitialDataQueryArguments = adapter.generateQueryArguments({
    operationName,
    mutator,
    definitions: '',
    isRequestOptions,
    type,
    queryParams,
    queryParam,
    initialData: 'defined',
    httpClient,
  });
  const undefinedInitialDataQueryArguments = adapter.generateQueryArguments({
    operationName,
    definitions: '',
    mutator,
    isRequestOptions,
    type,
    queryParams,
    queryParam,
    initialData: 'undefined',
    httpClient,
  });
  const queryArguments = adapter.generateQueryArguments({
    operationName,
    definitions: '',
    mutator,
    isRequestOptions,
    type,
    queryParams,
    queryParam,
    httpClient,
  });

  // Separate arguments for getQueryOptions function (includes http: HttpClient param for Angular)
  const queryArgumentsForOptions = adapter.generateQueryArguments({
    operationName,
    definitions: '',
    mutator,
    isRequestOptions,
    type,
    queryParams,
    queryParam,
    httpClient,
    forQueryOptions: true,
  });

  const queryOptions = getQueryOptions({
    isRequestOptions,
    isExactOptionalPropertyTypes,
    mutator,
    hasSignal,
    httpClient,
    hasSignalParam,
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
    hasSignalParam,
  });

  const queryOptionFnReturnType = getQueryOptionsDefinition({
    operationName,
    mutator,
    definitions: '',
    type,
    prefix: adapter.getQueryOptionsDefinitionPrefix(),
    hasQueryV5,
    hasQueryV5WithInfiniteQueryOptionsError,
    queryParams,
    queryParam,
    isReturnType: true,
    adapter,
  });

  const queryOptionsImp = generateQueryOptions({
    params,
    options,
    type,
    adapter,
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
      ? `, ${queryParams.schema.name}['${queryParam}']`
      : '';
  const TData =
    hasQueryV5 &&
    (type === QueryType.INFINITE || type === QueryType.SUSPENSE_INFINITE)
      ? `InfiniteData<Awaited<ReturnType<${dataType}>>${infiniteParam}>`
      : `Awaited<ReturnType<${dataType}>>`;

  // For Angular, add http: HttpClient as FIRST param (required, before optional params)
  // This avoids TS1016 "required param cannot follow optional param"
  const httpFirstParam = adapter.getHttpFirstParam(mutator);

  const queryOptionsFn = `export const ${queryOptionsFnName} = <TData = ${TData}, TError = ${errorType}>(${httpFirstParam}${queryProps} ${queryArgumentsForOptions}) => {

${hookOptions}

  const queryKey =  ${
    queryKeyMutator
      ? `${queryKeyMutator.name}({ ${queryProperties} }${
          queryKeyMutator.hasSecondArg
            ? `, { url: \`${route}\`, queryOptions }`
            : ''
        });`
      : `${adapter.getQueryKeyPrefix()}${queryKeyFnName}(${queryKeyProperties});`
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
        ? `, QueryKey, ${queryParams.schema.name}['${queryParam}']`
        : ''
    }> = (${queryFnArguments}) => ${operationName}(${httpFunctionProps}${
      httpFunctionProps ? ', ' : ''
    }${queryOptions});

      ${adapter.getUnrefStatements(props)}

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
     adapter.shouldAnnotateQueryKey()
       ? `& { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`
       : ''
   }
}`;
  const operationPrefix = adapter.hookPrefix;
  const optionalQueryClientArgument = adapter.getOptionalQueryClientArgument();

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
    queryArguments: queryArgumentsForOptions,
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

  // Generate query init (e.g. const queryOptions = fn(...) or const http = inject(HttpClient))
  const queryInit = adapter.generateQueryInit({
    queryOptionsFnName,
    queryProperties,
    isRequestOptions,
    mutator,
  });

  // Generate query hook invocation arguments
  const queryInvocationArgs = adapter.generateQueryInvocationArgs({
    props,
    queryOptionsFnName,
    queryProperties,
    isRequestOptions,
    mutator,
    operationPrefix,
    type,
    queryOptionsVarName,
    optionalQueryClientArgument,
  });

  const queryInvocationSuffix = adapter.getQueryInvocationSuffix();

  return `
${queryOptionsFn}

export type ${pascal(
    name,
  )}QueryResult = NonNullable<Awaited<ReturnType<${dataType}>>>
export type ${pascal(name)}QueryError = ${errorType}

${adapter.shouldGenerateOverrideTypes() ? overrideTypes : ''}
${doc}
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${adapter.getHookPropsDefinitions(
    props,
  )} ${queryArguments} ${optionalQueryClientArgument} \n ): ${returnType} {

  ${queryInit}

  const ${queryResultVarName} = ${camel(
    `${operationPrefix}-${adapter.getQueryType(type)}`,
  )}(${queryInvocationArgs}${queryInvocationSuffix}) as ${returnType};

  ${adapter.getQueryReturnStatement({
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
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  outputClient: OutputClient | OutputClientFunc,
  adapter?: FrameworkAdapter,
) => {
  if (!adapter) {
    throw new Error('FrameworkAdapter is required for generateQueryHook');
  }

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
  const {
    route,
    override: { operations },
    context,
    output,
  } = options;

  // Use adapter to transform props (Vue wraps with MaybeRef)
  const props = adapter.transformProps(_props);

  const query = override.query;
  const isRequestOptions = override.requestOptions !== false;
  const operationQueryOptions = operations[operationId]?.query;
  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

  const httpClient = context.output.httpClient;
  const doc = jsDoc({ summary, deprecated });

  let implementation = '';
  let mutators: GeneratorMutator[] | undefined;

  // Allows operationQueryOptions (which is the Orval config override for the operationId)
  // to override non-GET verbs
  const hasOperationQueryOption = [
    operationQueryOptions?.useQuery,
    operationQueryOptions?.useSuspenseQuery,
    operationQueryOptions?.useInfinite,
    operationQueryOptions?.useSuspenseInfiniteQuery,
  ].some(Boolean);

  let isQuery =
    (Verbs.GET === verb &&
      [
        override.query.useQuery,
        override.query.useSuspenseQuery,
        override.query.useInfinite,
        override.query.useSuspenseInfiniteQuery,
      ].some(Boolean)) ||
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

    // Use adapter to determine how to map props to query properties
    const queryProperties = props
      .map((param) => {
        return adapter.getQueryPropertyForProp(param, body);
      })
      .join(',');

    const queryKeyProperties = props
      .filter((prop) => prop.type !== GetterPropType.HEADER)
      .map((param) => {
        return adapter.getQueryPropertyForProp(param, body);
      })
      .join(',');

    const queries = [
      ...(query.useInfinite || operationQueryOptions?.useInfinite
        ? [
            {
              name: camel(`${operationName}-infinite`),
              options: query.options,
              type: QueryType.INFINITE,
              queryParam: query.useInfiniteQueryParam,
              queryKeyFnName: camel(`get-${operationName}-infinite-query-key`),
            },
          ]
        : []),
      ...(query.useQuery || operationQueryOptions?.useQuery
        ? [
            {
              name: operationName,
              options: query.options,
              type: QueryType.QUERY,
              queryKeyFnName: camel(`get-${operationName}-query-key`),
            },
          ]
        : []),
      ...(query.useSuspenseQuery || operationQueryOptions?.useSuspenseQuery
        ? [
            {
              name: camel(`${operationName}-suspense`),
              options: query.options,
              type: QueryType.SUSPENSE_QUERY,
              queryKeyFnName: camel(`get-${operationName}-query-key`),
            },
          ]
        : []),
      ...(query.useSuspenseInfiniteQuery ||
      operationQueryOptions?.useSuspenseInfiniteQuery
        ? [
            {
              name: camel(`${operationName}-suspense-infinite`),
              options: query.options,
              type: QueryType.SUSPENSE_INFINITE,
              queryParam: query.useInfiniteQueryParam,
              queryKeyFnName: camel(`get-${operationName}-infinite-query-key`),
            },
          ]
        : []),
    ];

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
        const makeOptionalParam = (impl: string) => {
          if (impl.includes('=')) return impl;
          return impl.replace(/^(\w+):\s*/, '$1?: ');
        };

        const queryKeyProps = toObjectString(
          props
            .filter((prop) => prop.type !== GetterPropType.HEADER)
            .map((prop) => ({
              ...prop,
              implementation:
                prop.type === GetterPropType.PARAM ||
                prop.type === GetterPropType.NAMED_PATH_PARAMS
                  ? prop.implementation
                  : makeOptionalParam(prop.implementation),
            })),
          'implementation',
        );

        const routeString = adapter.getQueryKeyRouteString(
          route,
          !!override.query.shouldSplitQueryKey,
        );

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
          httpClient,
          isExactOptionalPropertyTypes,
          hasSignal: getHasSignal({
            overrideQuerySignal: override.query.signal,
          }),
          queryOptionsMutator,
          queryKeyMutator,
          route,
          doc,
          usePrefetch: query.usePrefetch,
          useQuery: query.useQuery,
          useInfinite: query.useInfinite,
          useInvalidate: query.useInvalidate,
          adapter,
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
      verbOptions: { ...verbOptions, props },
      options,
      isRequestOptions,
      httpClient,
      doc,
      adapter,
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
