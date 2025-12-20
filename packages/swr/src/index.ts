import {
  camel,
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  generateVerbImports,
  type GeneratorDependency,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GetterParams,
  type GetterProp,
  type GetterProps,
  GetterPropType,
  type GetterResponse,
  jsDoc,
  OutputHttpClient,
  pascal,
  stringify,
  type SwrOptions,
  toObjectString,
  Verbs,
} from '@orval/core';

import {
  AXIOS_DEPENDENCIES,
  generateSwrRequestFunction,
  getHttpRequestSecondArg,
  getSwrErrorType,
  getSwrHeader,
  getSwrMutationFetcherOptionType,
  getSwrMutationFetcherType,
  getSwrRequestOptions,
  getSwrRequestSecondArg,
} from './client';

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

const SWR_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useSwr', values: true, default: true },
      { name: 'SWRConfiguration' },
      { name: 'Key' },
      { name: 'Arguments' },
    ],
    dependency: 'swr',
  },
];

const SWR_INFINITE_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useSWRInfinite', values: true, default: true },
      { name: 'SWRInfiniteConfiguration' },
      { name: 'SWRInfiniteKeyLoader' },
    ],
    dependency: 'swr/infinite',
  },
];

const SWR_MUTATION_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'useSWRMutation', values: true, default: true },
      { name: 'SWRMutationConfiguration' },
      { name: 'SWRMutationKey' },
    ],
    dependency: 'swr/mutation',
  },
];

export const getSwrDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator: boolean,
  hasParamsSerializerOptions: boolean,
  _packageJson,
  httpClient?: OutputHttpClient,
) => [
  ...(!hasGlobalMutator && httpClient === OutputHttpClient.AXIOS
    ? AXIOS_DEPENDENCIES
    : []),
  ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
  ...SWR_DEPENDENCIES,
  ...SWR_INFINITE_DEPENDENCIES,
  ...SWR_MUTATION_DEPENDENCIES,
];

const generateSwrArguments = ({
  operationName,
  mutator,
  isRequestOptions,
  isInfinite,
  httpClient,
}: {
  operationName: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  isInfinite: boolean;
  httpClient: OutputHttpClient;
}) => {
  const configType = isInfinite
    ? 'SWRInfiniteConfiguration'
    : 'SWRConfiguration';
  const optionsType = isInfinite
    ? '{ swrKeyLoader?: SWRInfiniteKeyLoader, enabled?: boolean }'
    : '{ swrKey?: Key, enabled?: boolean }';
  const definition = `${configType}<Awaited<ReturnType<typeof ${operationName}>>, TError> & ${optionsType}`;

  if (!isRequestOptions) {
    return `swrOptions?: ${definition}`;
  }

  return `options?: { swr?:${definition}, ${getSwrRequestOptions(httpClient, mutator)} }\n`;
};

const generateSwrMutationArguments = ({
  operationName,
  isRequestOptions,
  mutator,
  swrBodyType,
  httpClient,
}: {
  operationName: string;
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
  swrBodyType: string;
  httpClient: OutputHttpClient;
}) => {
  const definition = `SWRMutationConfiguration<Awaited<ReturnType<typeof ${operationName}>>, TError, Key, ${swrBodyType}, Awaited<ReturnType<typeof ${operationName}>>> & { swrKey?: string }`;

  if (!isRequestOptions) {
    return `swrOptions?: ${definition}`;
  }

  return `options?: { swr?:${definition}, ${getSwrRequestOptions(httpClient, mutator)}}\n`;
};

const generateSwrImplementation = ({
  operationName,
  swrKeyFnName,
  swrKeyLoaderFnName,
  swrProperties,
  swrKeyProperties,
  params,
  mutator,
  isRequestOptions,
  response,
  swrOptions,
  props,
  doc,
  httpClient,
  pathOnlyParams,
  headerOnlyParams,
  hasQueryParams,
  queryParamType,
}: {
  isRequestOptions: boolean;
  operationName: string;
  swrKeyFnName: string;
  swrKeyLoaderFnName: string;
  swrProperties: string;
  swrKeyProperties: string;
  params: GetterParams;
  props: GetterProps;
  response: GetterResponse;
  mutator?: GeneratorMutator;
  swrOptions: SwrOptions;
  doc?: string;
  httpClient: OutputHttpClient;
  pathOnlyParams: string;
  headerOnlyParams: string;
  hasQueryParams: boolean;
  queryParamType: string;
}) => {
  const swrProps = toObjectString(props, 'implementation');

  const hasParamReservedWord = props.some(
    (prop: GetterProp) => prop.name === 'query',
  );
  const queryResultVarName = hasParamReservedWord ? '_query' : 'query';

  const httpFunctionProps = swrProperties;

  const enabledImplementation = `const isEnabled = swrOptions?.enabled !== false${
    params.length > 0
      ? ` && !!(${params.map(({ name }) => name).join(' && ')})`
      : ''
  }`;
  const swrKeyImplementation = `const swrKey = swrOptions?.swrKey ?? (() => isEnabled ? ${swrKeyFnName}(${swrKeyProperties}) : null);`;
  const swrKeyLoaderImplementation = `const swrKeyLoader = swrOptions?.swrKeyLoader ?? (isEnabled ? ${swrKeyLoaderFnName}(${swrKeyProperties}) : () => null);`;

  const errorType = getSwrErrorType(response, httpClient, mutator);
  const swrRequestSecondArg = getSwrRequestSecondArg(httpClient, mutator);
  const httpRequestSecondArg = getHttpRequestSecondArg(httpClient, mutator);

  const useSWRInfiniteImplementation = swrOptions.useInfinite
    ? `
export type ${pascal(
        operationName,
      )}InfiniteQueryResult = NonNullable<Awaited<ReturnType<typeof ${operationName}>>>
export type ${pascal(operationName)}InfiniteError = ${errorType}

${doc}export const ${camel(
        `use-${operationName}-infinite`,
      )} = <TError = ${errorType}>(
  ${swrProps} ${generateSwrArguments({
    operationName,
    mutator,
    isRequestOptions,
    isInfinite: true,
    httpClient,
  })}) => {
  ${
    isRequestOptions
      ? `const {swr: swrOptions${swrRequestSecondArg ? `, ${swrRequestSecondArg}` : ''}} = options ?? {}`
      : ''
  }

  ${enabledImplementation}
  ${swrKeyLoaderImplementation}
  const swrFn = ${
    hasQueryParams
      ? `([_url, pageParams]: [string, ${queryParamType} & { page: number }]) => ${operationName}(${pathOnlyParams}${pathOnlyParams ? ', ' : ''}pageParams${headerOnlyParams ? ', ' + headerOnlyParams : ''}${httpRequestSecondArg ? ', ' + httpRequestSecondArg : ''})`
      : `([_url]: [string]) => ${operationName}(${pathOnlyParams}${headerOnlyParams ? (pathOnlyParams ? ', ' : '') + headerOnlyParams : ''}${httpRequestSecondArg ? (pathOnlyParams || headerOnlyParams ? ', ' : '') + httpRequestSecondArg : ''})`
  }

  const ${queryResultVarName} = useSWRInfinite<Awaited<ReturnType<typeof swrFn>>, TError>(swrKeyLoader, swrFn, ${
    swrOptions.swrInfiniteOptions
      ? `{
    ${stringify(swrOptions.swrInfiniteOptions)?.slice(1, -1)}
    ...swrOptions
  }`
      : 'swrOptions'
  })

  return {
    swrKeyLoader,
    ...${queryResultVarName}
  }
}\n`
    : '';

  const useSwrImplementation = `
export type ${pascal(
    operationName,
  )}QueryResult = NonNullable<Awaited<ReturnType<typeof ${operationName}>>>
export type ${pascal(operationName)}QueryError = ${errorType}

${doc}export const ${camel(`use-${operationName}`)} = <TError = ${errorType}>(
  ${swrProps} ${generateSwrArguments({
    operationName,
    mutator,
    isRequestOptions,
    isInfinite: false,
    httpClient,
  })}) => {
  ${
    isRequestOptions
      ? `const {swr: swrOptions${swrRequestSecondArg ? `, ${swrRequestSecondArg}` : ''}} = options ?? {}`
      : ''
  }

  ${enabledImplementation}
  ${swrKeyImplementation}
  const swrFn = () => ${operationName}(${httpFunctionProps}${
    httpFunctionProps && httpRequestSecondArg ? ', ' : ''
  }${httpRequestSecondArg})

  const ${queryResultVarName} = useSwr<Awaited<ReturnType<typeof swrFn>>, TError>(swrKey, swrFn, ${
    swrOptions.swrOptions
      ? `{
    ${stringify(swrOptions.swrOptions)?.slice(1, -1)}
    ...swrOptions
  }`
      : 'swrOptions'
  })

  return {
    swrKey,
    ...${queryResultVarName}
  }
}\n`;

  return useSWRInfiniteImplementation + useSwrImplementation;
};

const generateSwrMutationImplementation = ({
  isRequestOptions,
  operationName,
  swrKeyFnName,
  swrMutationFetcherName,
  swrKeyProperties,
  swrMutationFetcherProperties,
  swrProps,
  props,
  response,
  mutator,
  swrOptions,
  doc,
  swrBodyType,
  httpClient,
  verb,
}: {
  isRequestOptions: boolean;
  operationName: string;
  swrKeyFnName: string;
  swrMutationFetcherName: string;
  swrKeyProperties: string;
  swrMutationFetcherProperties: string;
  swrProps: string;
  props: GetterProps;
  response: GetterResponse;
  mutator?: GeneratorMutator;
  swrOptions: SwrOptions;
  doc?: string;
  swrBodyType: string;
  httpClient: OutputHttpClient;
  verb?: Verbs;
}) => {
  const hasParamReservedWord = props.some(
    (prop: GetterProp) => prop.name === 'query',
  );
  const queryResultVarName = hasParamReservedWord ? '_query' : 'query';

  const swrKeyImplementation = `const swrKey = swrOptions?.swrKey ?? ${swrKeyFnName}(${swrKeyProperties});`;

  const errorType = getSwrErrorType(response, httpClient, mutator);
  const swrRequestSecondArg = getSwrRequestSecondArg(httpClient, mutator);
  const httpRequestSecondArg = getHttpRequestSecondArg(httpClient, mutator);

  const useSwrImplementation = `
export type ${pascal(
    operationName,
  )}MutationResult = NonNullable<Awaited<ReturnType<typeof ${operationName}>>>
export type ${pascal(operationName)}MutationError = ${errorType}

${doc}export const ${camel(`use-${operationName}${verb === Verbs.GET ? '-mutation' : ''}`)} = <TError = ${errorType}>(
  ${swrProps} ${generateSwrMutationArguments({
    operationName,
    isRequestOptions,
    mutator,
    swrBodyType,
    httpClient,
  })}) => {

  ${isRequestOptions ? `const {swr: swrOptions${swrRequestSecondArg ? `, ${swrRequestSecondArg}` : ''}} = options ?? {}` : ''}

  ${swrKeyImplementation}
  const swrFn = ${swrMutationFetcherName}(${swrMutationFetcherProperties}${
    swrMutationFetcherProperties && httpRequestSecondArg ? ', ' : ''
  }${httpRequestSecondArg});

  const ${queryResultVarName} = useSWRMutation(swrKey, swrFn, ${
    swrOptions.swrMutationOptions
      ? `{
    ${stringify(swrOptions.swrMutationOptions)?.slice(1, -1)}
    ...swrOptions
  }`
      : 'swrOptions'
  })

  return {
    swrKey,
    ...${queryResultVarName}
  }
}\n`;

  return useSwrImplementation;
};

const generateSwrHook = (
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
    summary,
    deprecated,
  }: GeneratorVerbOptions,
  { route, context }: GeneratorOptions,
) => {
  const isRequestOptions = override.requestOptions !== false;
  const httpClient = context.output.httpClient;
  const doc = jsDoc({ summary, deprecated });

  const queryKeyProps = toObjectString(
    props.filter(
      (prop) =>
        prop.type === GetterPropType.PARAM ||
        prop.type === GetterPropType.NAMED_PATH_PARAMS ||
        prop.type === GetterPropType.QUERY_PARAM,
    ),
    'implementation',
  );

  const swrProps = toObjectString(
    props.filter(
      (prop) =>
        prop.type === GetterPropType.PARAM ||
        prop.type === GetterPropType.QUERY_PARAM ||
        prop.type === GetterPropType.NAMED_PATH_PARAMS ||
        prop.type === GetterPropType.HEADER,
    ),
    'implementation',
  );

  const swrMutationFetcherProperties = props
    .filter(
      (prop) =>
        prop.type === GetterPropType.PARAM ||
        prop.type === GetterPropType.QUERY_PARAM ||
        prop.type === GetterPropType.NAMED_PATH_PARAMS ||
        prop.type === GetterPropType.HEADER,
    )
    .map((param) => {
      return param.type === GetterPropType.NAMED_PATH_PARAMS
        ? param.destructured
        : param.name;
    })
    .join(',');

  const swrKeyProperties = props
    .filter(
      (prop) =>
        prop.type === GetterPropType.PARAM ||
        prop.type === GetterPropType.NAMED_PATH_PARAMS ||
        prop.type === GetterPropType.QUERY_PARAM,
    )
    .map((prop) => {
      return prop.type === GetterPropType.NAMED_PATH_PARAMS
        ? prop.destructured
        : prop.name;
    })
    .join(',');

  const swrMutationFetcherName = camel(`get-${operationName}-mutation-fetcher`);

  if (verb === Verbs.GET) {
    const swrKeyProperties = props
      .filter((prop) => prop.type !== GetterPropType.HEADER)
      .map((param) => {
        if (param.type === GetterPropType.NAMED_PATH_PARAMS)
          return param.destructured;
        return param.type === GetterPropType.BODY
          ? body.implementation
          : param.name;
      })
      .join(',');

    const swrProperties = props
      .map((param) => {
        if (param.type === GetterPropType.NAMED_PATH_PARAMS)
          return param.destructured;
        return param.type === GetterPropType.BODY
          ? body.implementation
          : param.name;
      })
      .join(',');

    // For useSWRInfinite: separate path params from query params
    const pathOnlyParams = props
      .filter(
        (prop) =>
          prop.type === GetterPropType.PARAM ||
          prop.type === GetterPropType.NAMED_PATH_PARAMS,
      )
      .map((param) => {
        return param.type === GetterPropType.NAMED_PATH_PARAMS
          ? param.destructured
          : param.name;
      })
      .join(',');

    const headerOnlyParams = props
      .filter((prop) => prop.type === GetterPropType.HEADER)
      .map((param) => param.name)
      .join(',');

    const hasQueryParams = props.some(
      (prop) => prop.type === GetterPropType.QUERY_PARAM,
    );

    // Extract just the type name from definition (e.g., "params: ListPetsParams" -> "ListPetsParams")
    const queryParamType =
      props
        .find((prop) => prop.type === GetterPropType.QUERY_PARAM)
        ?.definition.split(': ')[1] ?? 'never';

    const queryKeyProps = toObjectString(
      props.filter((prop) => prop.type !== GetterPropType.HEADER),
      'implementation',
    );

    const swrKeyFnName = camel(`get-${operationName}-key`);
    const swrKeyFn = `
export const ${swrKeyFnName} = (${queryKeyProps}) => [\`${route}\`${
      queryParams ? ', ...(params ? [params]: [])' : ''
    }] as const;
`;

    const swrKeyLoaderFnName = camel(
      `get-${operationName}-infinite-key-loader`,
    );
    const swrKeyLoader = override.swr.useInfinite
      ? `export const ${swrKeyLoaderFnName} = (${queryKeyProps}) => {
  return (page: number, previousPageData?: Awaited<ReturnType<typeof ${operationName}>>) => {
    if (previousPageData) {
      const responseData = previousPageData.data
      if (!responseData) return null

      // Direct array response (e.g., API returns Pet[]) - stop when empty
      if (Array.isArray(responseData) && responseData.length === 0) return null

      // Wrapped response with data array (e.g., { data: Pet[], ... }) - stop when nested array is empty
      if (typeof responseData === 'object' && 'data' in responseData) {
        if (Array.isArray(responseData.data) && responseData.data.length === 0) return null
      }

      // Single object response (non-paginated endpoint) - stop after first page
      if (!Array.isArray(responseData) && !(typeof responseData === 'object' && 'data' in responseData)) return null
    }

    return [\`${route}\`${queryParams ? ', ...(params ? [{...params,page}]: [{page}])' : ''}${
      body.implementation ? `, ${body.implementation}` : ''
    }] as const;
  }
}\n`
      : '';

    const swrImplementation = generateSwrImplementation({
      operationName,
      swrKeyFnName,
      swrKeyLoaderFnName,
      swrProperties,
      swrKeyProperties,
      params,
      props,
      mutator,
      isRequestOptions,
      response,
      swrOptions: override.swr,
      doc,
      httpClient,
      pathOnlyParams,
      headerOnlyParams,
      hasQueryParams,
      queryParamType,
    });

    if (!override.swr.useSWRMutationForGet) {
      return swrKeyFn + swrKeyLoader + swrImplementation;
    }

    // For OutputClient.SWR_GET_MUTATION, generate both useSWR and useSWRMutation
    const httpFnPropertiesForGetWithoutHeaders = props
      .filter((prop) => prop.type !== GetterPropType.HEADER)
      .map((prop) => {
        return prop.type === GetterPropType.NAMED_PATH_PARAMS
          ? prop.destructured
          : prop.name;
      })
      .join(', ');

    const headerParamsForGet = props
      .filter((prop) => prop.type === GetterPropType.HEADER)
      .map((param) => param.name)
      .join(', ');

    const httpFnPropertiesForGet = [
      httpFnPropertiesForGetWithoutHeaders,
      headerParamsForGet,
    ]
      .filter(Boolean)
      .join(', ');

    const swrMutationFetcherType = getSwrMutationFetcherType(
      response,
      httpClient,
      override.fetch.includeHttpResponseReturnType,
      operationName,
      mutator,
    );
    const swrMutationFetcherOptionType = getSwrMutationFetcherOptionType(
      httpClient,
      mutator,
    );

    const swrMutationFetcherOptions =
      isRequestOptions && swrMutationFetcherOptionType
        ? `options${context.output.optionsParamRequired ? '' : '?'}: ${swrMutationFetcherOptionType}`
        : '';

    const swrMutationFetcherFn = `
export const ${swrMutationFetcherName} = (${queryKeyProps} ${swrMutationFetcherOptions}) => {
  return (_: Key, __: { arg?: never }): ${swrMutationFetcherType} => {
    return ${operationName}(${httpFnPropertiesForGet}${
      swrMutationFetcherOptions.length > 0
        ? (httpFnPropertiesForGet.length > 0 ? ', ' : '') + 'options'
        : ''
    });
  }
}
`;

    const swrMutationImplementation = generateSwrMutationImplementation({
      operationName,
      swrKeyFnName,
      swrMutationFetcherName,
      swrKeyProperties,
      swrMutationFetcherProperties,
      swrProps,
      props,
      isRequestOptions,
      response,
      mutator,
      swrOptions: override.swr,
      doc,
      swrBodyType: 'never',
      httpClient,
      verb: Verbs.GET,
    });

    return (
      swrKeyFn +
      swrKeyLoader +
      swrImplementation +
      swrMutationFetcherFn +
      swrMutationImplementation
    );
  } else {
    const httpFnPropertiesWithoutHeaders = props
      .filter((prop) => prop.type !== GetterPropType.HEADER)
      .map((prop) => {
        if (prop.type === GetterPropType.NAMED_PATH_PARAMS) {
          return prop.destructured;
        } else if (prop.type === GetterPropType.BODY) {
          return `arg`;
        } else {
          return prop.name;
        }
      })
      .join(', ');

    const headerParams = props
      .filter((prop) => prop.type === GetterPropType.HEADER)
      .map((param) => param.name)
      .join(', ');

    const httpFnProperties = [httpFnPropertiesWithoutHeaders, headerParams]
      .filter(Boolean)
      .join(', ');

    const swrKeyFnName = camel(`get-${operationName}-mutation-key`);
    const swrMutationKeyFn = `export const ${swrKeyFnName} = (${queryKeyProps}) => [\`${route}\`${
      queryParams ? ', ...(params ? [params]: [])' : ''
    }] as const;
`;

    const swrMutationFetcherOptionType = getSwrMutationFetcherOptionType(
      httpClient,
      mutator,
    );

    const swrMutationFetcherOptions =
      isRequestOptions && swrMutationFetcherOptionType
        ? `options${context.output.optionsParamRequired ? '' : '?'}: ${swrMutationFetcherOptionType}`
        : '';

    const swrMutationFetcherArg = props.some(
      (prop) => prop.type === GetterPropType.BODY,
    )
      ? '{ arg }'
      : '__';

    const swrBodyType =
      props
        .find((prop) => prop.type === GetterPropType.BODY)
        ?.implementation.split(': ')[1] ?? 'Arguments';

    const swrMutationFetcherFn = `
export const ${swrMutationFetcherName} = (${swrProps} ${swrMutationFetcherOptions}) => {
  return (_: Key, ${swrMutationFetcherArg}: { arg: ${swrBodyType} }) => {
    return ${operationName}(${httpFnProperties}${
      swrMutationFetcherOptions.length > 0
        ? (httpFnProperties.length > 0 ? ', ' : '') + 'options'
        : ''
    });
  }
}\n`;

    const swrImplementation = generateSwrMutationImplementation({
      operationName,
      swrKeyFnName,
      swrMutationFetcherName,
      swrKeyProperties,
      swrMutationFetcherProperties,
      swrProps,
      props,
      isRequestOptions,
      response,
      mutator,
      swrOptions: override.swr,
      doc,
      swrBodyType,
      httpClient: context.output.httpClient,
    });

    return swrMutationFetcherFn + swrMutationKeyFn + swrImplementation;
  }
};

export const generateSwrHeader: ClientHeaderBuilder = (params) =>
  `
  ${
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
  ${getSwrHeader(params)}
`;

export const generateSwr: ClientBuilder = (verbOptions, options) => {
  const imports = generateVerbImports(verbOptions);
  const functionImplementation = generateSwrRequestFunction(
    verbOptions,
    options,
  );
  const hookImplementation = generateSwrHook(verbOptions, options);

  return {
    implementation: `${functionImplementation}\n\n${hookImplementation}`,
    imports,
  };
};

const swrClientBuilder: ClientGeneratorsBuilder = {
  client: generateSwr,
  header: generateSwrHeader,
  dependencies: getSwrDependencies,
};

export const builder = () => () => swrClientBuilder;

export default builder;
