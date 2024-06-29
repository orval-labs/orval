import {
  camel,
  ClientBuilder,
  ClientDependenciesBuilder,
  ClientGeneratorsBuilder,
  ClientHeaderBuilder,
  generateVerbImports,
  GeneratorDependency,
  GeneratorMutator,
  GeneratorOptions,
  GeneratorVerbOptions,
  GetterParams,
  GetterProp,
  GetterProps,
  GetterPropType,
  GetterResponse,
  pascal,
  stringify,
  toObjectString,
  Verbs,
  jsDoc,
  SwrOptions,
} from '@orval/core';
import {
  AXIOS_DEPENDENCIES,
  generateSwrRequestFunction,
  getSwrRequestOptions,
  getSwrErrorType,
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
) => [
  ...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []),
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
}: {
  operationName: string;
  mutator?: GeneratorMutator;
  isRequestOptions: boolean;
  isInfinite: boolean;
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

  return `options?: { swr?:${definition}, ${getSwrRequestOptions(mutator)} }\n`;
};

const generateSwrMutationArguments = ({
  operationName,
  isRequestOptions,
  mutator,
  swrBodyType,
}: {
  operationName: string;
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
  swrBodyType: string;
}) => {
  const definition = `SWRMutationConfiguration<Awaited<ReturnType<typeof ${operationName}>>, TError, string, ${swrBodyType}, Awaited<ReturnType<typeof ${operationName}>>> & { swrKey?: string }`;

  if (!isRequestOptions) {
    return `swrOptions?: ${definition}`;
  }

  return `options?: { swr?:${definition}, ${getSwrRequestOptions(mutator)}}\n`;
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
}) => {
  const swrProps = toObjectString(props, 'implementation');

  const hasParamReservedWord = props.some(
    (prop: GetterProp) => prop.name === 'query',
  );
  const queryResultVarName = hasParamReservedWord ? '_query' : 'query';

  const httpFunctionProps = swrProperties;

  const enabledImplementation = `const isEnabled = swrOptions?.enabled !== false${
    params.length
      ? ` && !!(${params.map(({ name }) => name).join(' && ')})`
      : ''
  }`;
  const swrKeyImplementation = `const swrKey = swrOptions?.swrKey ?? (() => isEnabled ? ${swrKeyFnName}(${swrKeyProperties}) : null);`;
  const swrKeyLoaderImplementation = `const swrKeyLoader = swrOptions?.swrKeyLoader ?? (() => isEnabled ? ${swrKeyLoaderFnName}(${swrKeyProperties}) : null);`;

  const errorType = getSwrErrorType(response, mutator);

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
  })}) => {
  ${
    isRequestOptions
      ? `const {swr: swrOptions${
          !mutator
            ? `, axios: axiosOptions`
            : mutator?.hasSecondArg
              ? ', request: requestOptions'
              : ''
        }} = options ?? {}`
      : ''
  }

  ${enabledImplementation}
  ${swrKeyLoaderImplementation}
  const swrFn = () => ${operationName}(${httpFunctionProps}${
    httpFunctionProps ? ', ' : ''
  }${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : mutator?.hasSecondArg
          ? 'requestOptions'
          : ''
      : ''
  });

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
  })}) => {
  ${
    isRequestOptions
      ? `const {swr: swrOptions${
          !mutator
            ? `, axios: axiosOptions`
            : mutator?.hasSecondArg
              ? ', request: requestOptions'
              : ''
        }} = options ?? {}`
      : ''
  }

  ${enabledImplementation}
  ${swrKeyImplementation}
  const swrFn = () => ${operationName}(${httpFunctionProps}${
    httpFunctionProps ? ', ' : ''
  }${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : mutator?.hasSecondArg
          ? 'requestOptions'
          : ''
      : ''
  });

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
}) => {
  const hasParamReservedWord = props.some(
    (prop: GetterProp) => prop.name === 'query',
  );
  const queryResultVarName = hasParamReservedWord ? '_query' : 'query';

  const swrKeyImplementation = `const swrKey = swrOptions?.swrKey ?? ${swrKeyFnName}(${swrKeyProperties});`;

  let errorType = `AxiosError<${response.definition.errors || 'unknown'}>`;

  if (mutator) {
    errorType = mutator.hasErrorType
      ? `ErrorType<${response.definition.errors || 'unknown'}>`
      : response.definition.errors || 'unknown';
  }

  const useSwrImplementation = `
export type ${pascal(
    operationName,
  )}MutationResult = NonNullable<Awaited<ReturnType<typeof ${operationName}>>>
export type ${pascal(operationName)}MutationError = ${errorType}

${doc}export const ${camel(`use-${operationName}`)} = <TError = ${errorType}>(
  ${swrProps} ${generateSwrMutationArguments({
    operationName,
    isRequestOptions,
    mutator,
    swrBodyType,
  })}) => {

  ${
    isRequestOptions
      ? `const {swr: swrOptions${
          !mutator
            ? `, axios: axiosOptions`
            : mutator?.hasSecondArg
              ? ', request: requestOptions'
              : ''
        }} = options ?? {}`
      : ''
  }

  ${swrKeyImplementation}
  const swrFn = ${swrMutationFetcherName}(${swrMutationFetcherProperties}${
    swrMutationFetcherProperties && isRequestOptions ? ',' : ''
  }${
    isRequestOptions
      ? !mutator
        ? `axiosOptions`
        : mutator?.hasSecondArg
          ? 'requestOptions'
          : ''
      : ''
  });

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
  const isRequestOptions = override?.requestOptions !== false;
  const doc = jsDoc({ summary, deprecated });

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

    const queryKeyProps = toObjectString(
      props.filter((prop) => prop.type !== GetterPropType.HEADER),
      'implementation',
    );

    const swrKeyFnName = camel(`get-${operationName}-key`);
    const swrKeyFn = `
export const ${swrKeyFnName} = (${queryKeyProps}) => [\`${route}\`${
      queryParams ? ', ...(params ? [params]: [])' : ''
    }${body.implementation ? `, ${body.implementation}` : ''}] as const;
\n`;

    const swrKeyLoaderFnName = camel(
      `get-${operationName}-infinite-key-loader`,
    );
    const swrKeyLoader = override.swr.useInfinite
      ? `export const ${swrKeyLoaderFnName} = (${queryKeyProps}) => {
  return (_: number, previousPageData: Awaited<ReturnType<typeof ${operationName}>>) => {
    if (previousPageData && !previousPageData.data) return null

    return [\`${route}\`${queryParams ? ', ...(params ? [params]: [])' : ''}${
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
    });

    return swrKeyFn + swrKeyLoader + swrImplementation;
  } else {
    const queryKeyProps = toObjectString(
      props.filter(
        (prop) =>
          prop.type === GetterPropType.PARAM ||
          prop.type === GetterPropType.NAMED_PATH_PARAMS,
      ),
      'implementation',
    );

    const swrProps = toObjectString(
      props.filter(
        (prop) =>
          prop.type === GetterPropType.PARAM ||
          prop.type === GetterPropType.QUERY_PARAM ||
          prop.type === GetterPropType.NAMED_PATH_PARAMS,
      ),
      'implementation',
    );

    const swrMutationFetcherProperties = props
      .filter(
        (prop) =>
          prop.type === GetterPropType.PARAM ||
          prop.type === GetterPropType.QUERY_PARAM ||
          prop.type === GetterPropType.NAMED_PATH_PARAMS,
      )
      .map((param) => {
        if (param.type === GetterPropType.NAMED_PATH_PARAMS) {
          return param.destructured;
        } else {
          return param.name;
        }
      })
      .join(',');

    const httpFnProperties = props
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

    const swrKeyProperties = props
      .filter(
        (prop) =>
          prop.type === GetterPropType.PARAM ||
          prop.type === GetterPropType.NAMED_PATH_PARAMS,
      )
      .map((prop) => {
        if (prop.type === GetterPropType.NAMED_PATH_PARAMS) {
          return prop.destructured;
        } else {
          return prop.name;
        }
      })
      .join(',');

    const swrKeyFnName = camel(`get-${operationName}-mutation-key`);
    const swrMutationKeyFn = `export const ${swrKeyFnName} = (${queryKeyProps}) => \`${route}\` as const;\n`;

    const swrMutationFetcherName = camel(
      `get-${operationName}-mutation-fetcher`,
    );
    const swrMutationFetcherType = mutator
      ? `Promise<${response.definition.success || 'unknown'}>`
      : `Promise<AxiosResponse<${response.definition.success || 'unknown'}>>`;
    const swrMutationFetcherOptionType = !mutator
      ? 'AxiosRequestConfig'
      : mutator.hasSecondArg
        ? `SecondParameter<typeof ${mutator.name}>`
        : '';
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
  return (_: string, ${swrMutationFetcherArg}: { arg: ${swrBodyType} }): ${swrMutationFetcherType} => {
    return ${operationName}(${httpFnProperties}${
      swrMutationFetcherOptions.length
        ? (httpFnProperties.length ? ', ' : '') + 'options'
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
    });

    return swrMutationFetcherFn + swrMutationKeyFn + swrImplementation;
  }
};

export const generateSwrHeader: ClientHeaderBuilder = ({
  isRequestOptions,
  isMutator,
  hasAwaitedType,
}) =>
  `
  ${
    !hasAwaitedType
      ? `type AwaitedInput<T> = PromiseLike<T> | T;\n
      type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;\n\n`
      : ''
  }
  ${
    isRequestOptions && isMutator
      ? `type SecondParameter<T extends (...args: any) => any> = Parameters<T>[1];\n\n`
      : ''
  }`;

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
