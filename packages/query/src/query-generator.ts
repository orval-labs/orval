import {
  camel,
  generateMutator,
  type GeneratorImport,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GetterBody,
  type GetterParams,
  type GetterProp,
  type GetterProps,
  GetterPropType,
  type GetterQueryParam,
  type GetterResponse,
  jsDoc,
  logWarning,
  OutputClient,
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

/**
 * Decide whether the current operation's configuration conflicts with a
 * `mutationInvalidates` rule. The rule wires its invalidation through the
 * Mutation hook's `onSuccess`, so referencing an operation that is not
 * generated as a Mutation (either forced into a Query via per-operation
 * `useQuery: true`, or suppressed entirely) makes the rule a silent no-op.
 *
 * Returns the warning message when the conflict applies, or `undefined`
 * when the configuration is consistent.
 */
export const getMutationInvalidatesConflictWarning = ({
  operationName,
  isMutation,
  isQuery,
  mutationInvalidates,
}: {
  operationName: string;
  isMutation: boolean | undefined;
  isQuery: boolean;
  mutationInvalidates:
    | NonNullable<
        GeneratorVerbOptions['override']['query']['mutationInvalidates']
      >
    | undefined;
}): string | undefined => {
  if (isMutation) return undefined;
  if (!mutationInvalidates?.length) return undefined;

  const referencingRule = mutationInvalidates.find((rule) =>
    rule.onMutations.includes(operationName),
  );
  if (!referencingRule) return undefined;

  const generatedAs = isQuery ? 'Query hook' : 'plain function (no hook)';
  return (
    `mutationInvalidates rule references '${operationName}', but that ` +
    `operation is generated as a ${generatedAs}, not a Mutation. The ` +
    `invalidation will not fire. Either remove '${operationName}' from the ` +
    `rule's onMutations list, or configure '${operationName}' so that it ` +
    `is generated as a Mutation hook.`
  );
};

const escapeRegExpMetaChars = (value: string): string =>
  value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Wraps the body parameter's type in a property string with the mutator's
 * `BodyType<T>` envelope so that user-facing Query helpers (hook signature,
 * `getXxxQueryOptions`, `getXxxQueryKey`, prefetch / invalidate / set+get
 * QueryData) match the request function's signature, which is already
 * wrapped by `client.ts`. Without this, callers that pass a plain body to
 * a non-GET Query hook (possible after #2376 routes non-GET verbs to
 * Query hooks) would hit a type mismatch against the underlying request
 * function.
 *
 * The pattern handles three prop shapes that the various
 * `toObjectString(props, ...)` callers can emit:
 *   - `name: T`                — required body
 *   - `name?: T`               — optional body
 *   - `name: undefined | T`    — `definedInitialData` overload transform
 *
 * `body.definition` is fully regex-escaped so types containing metachars
 * (e.g. `Pet[]`, `Foo | Bar`, anonymous object types) are matched
 * verbatim rather than reinterpreted as regex syntax.
 *
 * No-op when the operation has no body or the mutator does not export a
 * `BodyType<T>` wrapper, so existing GET-only Query keys are unchanged.
 */
export const wrapPropsBodyWithMutatorBodyType = ({
  propsString,
  body,
  mutator,
}: {
  propsString: string;
  body: GetterBody;
  mutator: GeneratorMutator | undefined;
}): string => {
  if (!mutator?.bodyTypeName || !body.definition) return propsString;
  const bodyDefinitionPattern = escapeRegExpMetaChars(body.definition);
  return propsString.replace(
    new RegExp(
      String.raw`(\w+\??:\s*(?:undefined\s*\|\s*)?)${bodyDefinitionPattern}`,
    ),
    `$1${mutator.bodyTypeName}<${body.definition}>`,
  );
};

/**
 * Computes a verb prefix segment for query keys when a non-GET operation is
 * routed to a Query hook. Without this prefix, two operations sharing a path
 * (e.g. `GET /pets` and `POST /pets`) would generate cache keys that both
 * begin with `'/pets'`, so TanStack Query would mix their cached data and
 * `invalidateQueries({ queryKey: ['/pets'] })` would match both.
 *
 * Skipped for GET (preserves existing keys) and when
 * `useOperationIdAsQueryKey` is enabled (operation IDs are already unique
 * across verb + path, so the prefix would be redundant).
 *
 * Returns the uppercased verb when a prefix should be inserted, or
 * `undefined` when no prefix is needed.
 */
export const getQueryKeyVerbPrefix = ({
  verb,
  useOperationIdAsQueryKey,
}: {
  verb: Verbs;
  useOperationIdAsQueryKey: boolean | undefined;
}): string | undefined => {
  if (useOperationIdAsQueryKey) return undefined;
  if (verb === Verbs.GET) return undefined;
  return verb.toUpperCase();
};

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
  body,
  mutator,
  queryOptionsMutator,
  queryKeyMutator,
  isRequestOptions,
  response,
  httpClient,
  isExactOptionalPropertyTypes,
  hasSignal,
  useRuntimeFetcher,
  route,
  doc,
  usePrefetch,
  useQuery,
  useInfinite,
  useInvalidate,
  useSetQueryData,
  useGetQueryData,
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
  body: GetterBody;
  response: GetterResponse;
  queryParams?: GetterQueryParam;
  mutator?: GeneratorMutator;
  queryOptionsMutator?: GeneratorMutator;
  queryKeyMutator?: GeneratorMutator;
  httpClient: OutputHttpClient;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  useRuntimeFetcher?: boolean;
  route: string;
  doc?: string;
  usePrefetch?: boolean;
  useQuery?: boolean;
  useInfinite?: boolean;
  useInvalidate?: boolean;
  useSetQueryData?: boolean;
  useGetQueryData?: boolean;
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

  const queryPropDefinitions = wrapPropsBodyWithMutatorBodyType({
    propsString: toObjectString(props, 'definition'),
    body,
    mutator,
  });
  const definedInitialDataQueryPropsDefinitions =
    wrapPropsBodyWithMutatorBodyType({
      propsString: toObjectString(
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
      ),
      body,
      mutator,
    });
  const queryProps = wrapPropsBodyWithMutatorBodyType({
    propsString: toObjectString(props, 'implementation'),
    body,
    mutator,
  });

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
    useRuntimeFetcher,
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
    useRuntimeFetcher,
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
    useRuntimeFetcher,
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
    useRuntimeFetcher,
  });

  const queryOptions = getQueryOptions({
    isRequestOptions,
    isExactOptionalPropertyTypes,
    mutator,
    hasSignal,
    httpClient,
    hasSignalParam,
    useRuntimeFetcher,
  });

  const hookOptions = getHookOptions({
    isRequestOptions,
    httpClient,
    mutator,
    useRuntimeFetcher,
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
   }${
     adapter.shouldCastQueryOptions?.() === false
       ? ''
       : ` as ${queryOptionFnReturnType} ${
           adapter.shouldAnnotateQueryKey()
             ? `& { queryKey: ${hasQueryV5 ? `DataTag<QueryKey, TData${hasQueryV5WithDataTagError ? ', TError' : ''}>` : 'QueryKey'} }`
             : ''
         }`
   }
}`;
  const operationPrefix = adapter.hookPrefix;
  const optionalQueryClientArgument = adapter.getOptionalQueryClientArgument();

  const queryHookName = camel(`${operationPrefix}-${name}`);

  const overrideTypes = `
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${definedInitialDataQueryPropsDefinitions} ${definedInitialDataQueryArguments} ${optionalQueryClientArgument}\n  ): ${definedInitialDataReturnType}
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${queryPropDefinitions} ${undefinedInitialDataQueryArguments} ${optionalQueryClientArgument}\n  ): ${returnType}
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${queryPropDefinitions} ${queryArguments} ${optionalQueryClientArgument}\n  ): ${returnType}`;

  const prefetchContext = {
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
  };

  const prefetch = adapter.generatePrefetch
    ? adapter.generatePrefetch(prefetchContext)
    : generatePrefetch(prefetchContext);

  const isPrimaryQueryType =
    type === QueryType.QUERY ||
    type === QueryType.INFINITE ||
    (type === QueryType.SUSPENSE_QUERY && !useQuery) ||
    (type === QueryType.SUSPENSE_INFINITE && !useInfinite);

  const buildBaseQueryKeyExpr = () =>
    queryKeyMutator
      ? `${queryKeyMutator.name}({ ${queryProperties} }${
          queryKeyMutator.hasSecondArg ? `, { url: \`${route}\` }` : ''
        })`
      : `${queryKeyFnName}(${queryKeyProperties})`;

  // queryOptions mutator may augment the queryKey (e.g. tenant prefix).
  // Route invalidate through the mutator so the key matches what the
  // query hook actually wrote into the cache. Hook-shaped mutators are
  // skipped because the invalidate helper is a plain async function.
  const applyQueryOptionsMutator = (baseExpr: string) =>
    queryOptionsMutator && !queryOptionsMutator.isHook
      ? `${queryOptionsMutator.name}({ queryKey: ${baseExpr} }${
          queryOptionsMutator.hasSecondArg ? `, { ${queryProperties} }` : ''
        }${
          queryOptionsMutator.hasThirdArg ? `, { url: \`${route}\` }` : ''
        }).queryKey`
      : baseExpr;

  const shouldGenerateInvalidate = useInvalidate && isPrimaryQueryType;
  const invalidateFnName = camel(`invalidate-${name}`);
  const invalidateQueryKeyExpr = applyQueryOptionsMutator(
    buildBaseQueryKeyExpr(),
  );

  const shouldGenerateSetQueryData = useSetQueryData && isPrimaryQueryType;
  const isReactQuery = adapter.outputClient === OutputClient.REACT_QUERY;
  const setQueryDataFnName = isReactQuery
    ? camel(`use-set-${name}-query-data`)
    : camel(`set-${name}-query-data`);
  const setQueryDataKeyExpr = buildBaseQueryKeyExpr();
  const setQueryDataProps = wrapPropsBodyWithMutatorBodyType({
    propsString: toObjectString(
      props.filter((prop) => prop.type !== GetterPropType.HEADER),
      'implementation',
    ).replaceAll('?:', ':'),
    body,
    mutator,
  });

  const shouldGenerateGetQueryData = useGetQueryData && isPrimaryQueryType;
  const getQueryDataFnName = isReactQuery
    ? camel(`use-get-${name}-query-data`)
    : camel(`get-${name}-query-data`);
  const getQueryDataKeyExpr = setQueryDataKeyExpr;
  const getQueryDataProps = setQueryDataProps;

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
export function ${queryHookName}<TData = ${TData}, TError = ${errorType}>(\n ${wrapPropsBodyWithMutatorBodyType(
    {
      propsString: adapter.getHookPropsDefinitions(props),
      body,
      mutator,
    },
  )} ${queryArguments} ${optionalQueryClientArgument} \n ): ${returnType} {

  ${queryInit}

  const ${queryResultVarName} = ${camel(
    `${operationPrefix}-${adapter.getQueryType(type)}`,
  )}(${queryInvocationArgs}${queryInvocationSuffix})${adapter.shouldCastQueryResult?.() === false ? '' : ` as ${returnType}`};

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

  await queryClient.invalidateQueries({ queryKey: ${invalidateQueryKeyExpr} }, options);

  return queryClient;
}\n`
    : ''
}
${
  shouldGenerateSetQueryData
    ? isReactQuery
      ? `${doc}export const ${setQueryDataFnName} = () => {
  const queryClient = useQueryClient();
  return (${setQueryDataProps}updater: ${TData} | undefined | ((old: ${TData} | undefined) => ${TData} | undefined)) => {
    queryClient.setQueryData(${setQueryDataKeyExpr}, updater);
  };
}\n`
      : `${doc}export const ${setQueryDataFnName} = (queryClient: QueryClient, ${setQueryDataProps}updater: ${TData} | undefined | ((old: ${TData} | undefined) => ${TData} | undefined)) => {
  queryClient.setQueryData(${setQueryDataKeyExpr}, updater);
}\n`
    : ''
}
${
  shouldGenerateGetQueryData
    ? isReactQuery
      ? `${doc}export const ${getQueryDataFnName} = () => {
  const queryClient = useQueryClient();
  return (${getQueryDataProps}) =>
    queryClient.getQueryData<${TData}>(${getQueryDataKeyExpr});
}\n`
      : `${doc}export const ${getQueryDataFnName} = (queryClient: QueryClient, ${getQueryDataProps}) =>
  queryClient.getQueryData<${TData}>(${getQueryDataKeyExpr});\n`
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

  // Precedence: per-operation override > global > per-verb default.
  // `?? false` lets per-op `false` actually disable a globally enabled
  // hook (the previous `[…].some(Boolean)` masked op-level false).
  const effectiveUseQuery =
    operationQueryOptions?.useQuery ??
    override.query.useQuery ??
    verb === Verbs.GET;
  const effectiveUseMutation =
    operationQueryOptions?.useMutation ??
    override.query.useMutation ??
    verb !== Verbs.GET;

  // Suspense / Infinite have no per-verb default; global is GET-only,
  // per-op overrides bypass that restriction in either direction.
  const globalSuspenseOrInfiniteOnlyForGet = (
    flag: boolean | undefined,
  ): boolean => flag === true && verb === Verbs.GET;
  const effectiveUseSuspenseQuery =
    operationQueryOptions?.useSuspenseQuery ??
    globalSuspenseOrInfiniteOnlyForGet(override.query.useSuspenseQuery);
  const effectiveUseInfinite =
    operationQueryOptions?.useInfinite ??
    globalSuspenseOrInfiniteOnlyForGet(override.query.useInfinite);
  const effectiveUseSuspenseInfiniteQuery =
    operationQueryOptions?.useSuspenseInfiniteQuery ??
    globalSuspenseOrInfiniteOnlyForGet(override.query.useSuspenseInfiniteQuery);

  let isQuery =
    effectiveUseQuery ||
    effectiveUseSuspenseQuery ||
    effectiveUseInfinite ||
    effectiveUseSuspenseInfiniteQuery;

  // No verb gate here: `effectiveUseMutation` already encodes the
  // per-verb default (`verb !== Verbs.GET`), so an explicit
  // `useMutation: true` — global or per-operation — must be honoured for
  // GET operations too, mirroring how `isQuery` honours `useQuery: true`
  // for non-GET verbs (#3358).
  let isMutation = effectiveUseMutation;

  // If both query and mutation are true for a non-GET operation, prioritize query
  if (verb !== Verbs.GET && isQuery) {
    isMutation = false;
  }

  // If both query and mutation are true for a GET operation, prioritize mutation
  if (verb === Verbs.GET && isMutation) {
    isQuery = false;
  }

  // Warn when an operation referenced by a `mutationInvalidates` rule's
  // `onMutations` list is generated as a Query (or no hook at all). The rule
  // is wired up in mutation-generator and only fires for Mutation hooks, so
  // referencing a Query-emitted operation is a silent no-op — surface that
  // misconfiguration explicitly.
  const conflictWarning = getMutationInvalidatesConflictWarning({
    operationName,
    isMutation,
    isQuery,
    mutationInvalidates: override.query.mutationInvalidates,
  });
  if (conflictWarning) {
    logWarning(conflictWarning);
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
      ...(effectiveUseInfinite
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
      ...(effectiveUseQuery
        ? [
            {
              name: operationName,
              options: query.options,
              type: QueryType.QUERY,
              queryKeyFnName: camel(`get-${operationName}-query-key`),
            },
          ]
        : []),
      ...(effectiveUseSuspenseQuery
        ? [
            {
              name: camel(`${operationName}-suspense`),
              options: query.options,
              type: QueryType.SUSPENSE_QUERY,
              queryKeyFnName: camel(`get-${operationName}-query-key`),
            },
          ]
        : []),
      ...(effectiveUseSuspenseInfiniteQuery
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

    let queryKeyFns = '';

    if (!queryKeyMutator) {
      for (const queryOption of uniqueQueryOptionsByKeys) {
        const makeOptionalParam = (impl: string) => {
          if (impl.includes('=')) return impl;
          return impl.replace(/^(\w+):\s*/, '$1?: ');
        };

        const queryKeyProps = wrapPropsBodyWithMutatorBodyType({
          propsString: toObjectString(
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
          ),
          body,
          mutator,
        });

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

        const verbPrefix = getQueryKeyVerbPrefix({
          verb,
          useOperationIdAsQueryKey: override.query.useOperationIdAsQueryKey,
        });

        // Note: do not unref() params in Vue - this will make key lose reactivity
        queryKeyFns += `
${override.query.shouldExportQueryKey ? 'export ' : ''}const ${queryOption.queryKeyFnName} = (${queryKeyProps}) => {
    return [
    ${[
      queryOption.type === QueryType.INFINITE ||
      queryOption.type === QueryType.SUSPENSE_INFINITE
        ? `'infinite'`
        : '',
      verbPrefix ? `'${verbPrefix}'` : '',
      queryKeyIdentifier,
      queryKeyParams,
      body.implementation,
    ]
      .filter((x) => !!x)
      .join(', ')}
    ] as const;
    }
`;
      }
    }

    implementation += `
${queryKeyFns}`;

    let queryImplementations = '';

    for (const queryOption of queries) {
      queryImplementations += generateQueryImplementation({
        queryOption,
        operationName,
        queryProperties,
        queryKeyProperties,
        params,
        props,
        body,
        mutator,
        isRequestOptions,
        queryParams,
        response,
        httpClient,
        isExactOptionalPropertyTypes,
        hasSignal: getHasSignal({
          overrideQuerySignal: override.query.signal,
        }),
        useRuntimeFetcher: override.fetch.useRuntimeFetcher,
        queryOptionsMutator,
        queryKeyMutator,
        route,
        doc,
        usePrefetch: query.usePrefetch,
        useQuery: effectiveUseQuery,
        useInfinite: effectiveUseInfinite,
        useInvalidate: query.useInvalidate,
        useSetQueryData:
          operationQueryOptions?.useSetQueryData ?? query.useSetQueryData,
        useGetQueryData:
          operationQueryOptions?.useGetQueryData ?? query.useGetQueryData,
        adapter,
      });
    }

    implementation += `
    ${queryImplementations}
`;

    mutators =
      queryOptionsMutator || queryKeyMutator
        ? [
            ...(queryOptionsMutator ? [queryOptionsMutator] : []),
            ...(queryKeyMutator ? [queryKeyMutator] : []),
          ]
        : undefined;
  }

  let imports: GeneratorImport[] = [];

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
    imports = mutationResult.imports;
  }

  return {
    implementation,
    mutators,
    imports,
  };
};
