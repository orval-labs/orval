import {
  camel,
  ClientBuilder,
  ClientDependenciesBuilder,
  ClientGeneratorsBuilder,
  ClientHeaderBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
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
  isSyntheticDefaultImportsAllow,
  pascal,
  stringify,
  toObjectString,
  Verbs,
  VERBS_WITH_BODY,
  jsDoc,
  SwrOptions,
} from '@orval/core';

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

const generateSwrRequestFunction = (
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
    paramsSerializer,
  }: GeneratorVerbOptions,
  { route, context }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);
  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.tsconfig,
  );

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
      hasSignal: false,
      isBodyVerb,
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
          override?.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    return `export const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options?: SecondParameter<typeof ${mutator.name}>`
        : ''
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
    paramsSerializer,
    paramsSerializerOptions: override?.paramsSerializerOptions,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  });

  return `export const ${operationName} = (\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${bodyForm}
    return axios${
      !isSyntheticDefaultImportsAllowed ? '.default' : ''
    }.${verb}(${options});
  }
`;
};

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

  return `options?: { swr?:${definition}, ${
    !mutator
      ? `axios?: AxiosRequestConfig`
      : mutator?.hasSecondArg
      ? `request?: SecondParameter<typeof ${mutator.name}>`
      : ''
  } }\n`;
};

const generateSwrMutationArguments = ({
  operationName,
  isRequestOptions,
  mutator,
}: {
  operationName: string;
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
}) => {
  const definition = `SWRMutationConfiguration<Awaited<ReturnType<typeof ${operationName}>>, TError, string, Arguments, Awaited<ReturnType<typeof ${operationName}>>> & { swrKey?: string }`;

  if (!isRequestOptions) {
    return `swrOptions?: ${definition}`;
  }

  return `options?: { swr?:${definition}, ${
    !mutator
      ? `axios?: AxiosRequestConfig`
      : mutator?.hasSecondArg
      ? `request?: SecondParameter<typeof ${mutator.name}>`
      : ''
  } }\n`;
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

  let errorType = `AxiosError<${response.definition.errors || 'unknown'}>`;

  if (mutator) {
    errorType = mutator.hasErrorType
      ? `ErrorType<${response.definition.errors || 'unknown'}>`
      : response.definition.errors || 'unknown';
  }

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
        swrOptions.options
          ? `{
    ${stringify(swrOptions.options)?.slice(1, -1)}
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
    swrOptions.options
      ? `{
    ${stringify(swrOptions.options)?.slice(1, -1)}
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
    swrOptions.options
      ? `{
    ${stringify(swrOptions.options)?.slice(1, -1)}
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
  { route }: GeneratorOptions,
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
          return `arg as ${prop.implementation.split(': ')[1]}`;
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
    const swrMutationFetcherOptions =
      !mutator && isRequestOptions ? 'options?: AxiosRequestConfig' : '';

    const swrMutationFetcherFn = `
export const ${swrMutationFetcherName} = (${swrProps} ${swrMutationFetcherOptions}) => {
  return (_: string, { arg }: { arg: Arguments }): ${swrMutationFetcherType} => {
    return ${operationName}(${httpFnProperties}${
      swrMutationFetcherOptions.length ? ', options' : ''
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
      ? `// eslint-disable-next-line
  type SecondParameter<T extends (...args: any) => any> = T extends (
  config: any,
  args: infer P,
) => any
  ? P
  : never;\n\n`
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
