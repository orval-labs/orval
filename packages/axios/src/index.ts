import {
  type ClientBuilder,
  type ClientDependenciesBuilder,
  type ClientFooterBuilder,
  type ClientGeneratorsBuilder,
  type ClientHeaderBuilder,
  type ClientTitleBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  type GeneratorDependency,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  isSyntheticDefaultImportsAllow,
  pascal,
  sanitize,
  toObjectString,
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
    ],
    dependency: 'axios',
  },
];

// Type-only imports for factory mode (no runtime axios import needed)
const AXIOS_FACTORY_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'AxiosInstance' },
      { name: 'AxiosRequestConfig' },
      { name: 'AxiosResponse' },
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

const returnTypesToWrite = new Map<string, (title?: string) => string>();

export const getAxiosDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator,
  hasParamsSerializerOptions: boolean,
) => [
  ...(hasGlobalMutator ? [] : AXIOS_DEPENDENCIES),
  ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
];

// Factory mode always needs AxiosInstance type for function signature
// When there's no mutator, also include AxiosRequestConfig and AxiosResponse
export const getAxiosFactoryDependencies: ClientDependenciesBuilder = (
  hasGlobalMutator,
  hasParamsSerializerOptions: boolean,
) => [
  {
    exports: [
      { name: 'AxiosInstance' },
      ...(hasGlobalMutator
        ? []
        : [{ name: 'AxiosRequestConfig' }, { name: 'AxiosResponse' }]),
    ],
    dependency: 'axios',
  },
  ...(hasParamsSerializerOptions ? PARAMS_SERIALIZER_DEPENDENCIES : []),
];

const generateAxiosImplementation = (
  {
    headers,
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    override,
    formData,
    formUrlEncoded,
    paramsSerializer,
  }: GeneratorVerbOptions,
  { route, context }: GeneratorOptions,
  isFactoryMode = false,
) => {
  const isRequestOptions = override.requestOptions !== false;
  const isFormData = !override.formData.disabled;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;

  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.output.tsconfig,
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
      isExactOptionalPropertyTypes,
    });

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    returnTypesToWrite.set(
      operationName,
      (title?: string) =>
        `export type ${pascal(
          operationName,
        )}Result = NonNullable<Awaited<ReturnType<${
          title
            ? `ReturnType<typeof ${title}>['${operationName}']`
            : `typeof ${operationName}`
        }>>>`,
    );

    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(String.raw`(\w*):\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    return `const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<typeof ${mutator.name}<${response.definition.success || 'unknown'}>>,`
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
    requestOptions: override.requestOptions,
    isFormData,
    isFormUrlEncoded,
    paramsSerializer,
    paramsSerializerOptions: override.paramsSerializerOptions,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  });

  returnTypesToWrite.set(
    operationName,
    () =>
      `export type ${pascal(operationName)}Result = AxiosResponse<${
        response.definition.success || 'unknown'
      }>`,
  );

  // In factory mode, axios is a parameter (AxiosInstance), so no .default needed
  // In functions mode with global import, .default may be needed based on tsconfig
  const axiosRef = isFactoryMode
    ? 'axios'
    : `axios${isSyntheticDefaultImportsAllowed ? '' : '.default'}`;

  return `const ${operationName} = <TData = AxiosResponse<${
    response.definition.success || 'unknown'
  }>>(\n    ${toObjectString(props, 'implementation')} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<TData> => {${bodyForm}
    return ${axiosRef}.${verb}(${options});
  }
`;
};

export const generateAxiosTitle: ClientTitleBuilder = (title) => {
  const sanTitle = sanitize(title);
  return `get${pascal(sanTitle)}`;
};

// Header for factory mode - axios is injected as parameter
export const generateAxiosHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  noFunction,
}) => `
${
  isRequestOptions && isMutator
    ? `type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];\n\n`
    : ''
}
  ${noFunction ? '' : `export const ${title} = (axios: AxiosInstance) => {\n`}`;

// Header for non-injection mode - uses global axios import
export const generateAxiosHeaderNoInjection: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
  noFunction,
}) => `
${
  isRequestOptions && isMutator
    ? `type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];\n\n`
    : ''
}
  ${noFunction ? '' : `export const ${title} = () => {\n`}`;

export const generateAxiosFooter: ClientFooterBuilder = ({
  operationNames,
  title,
  noFunction,
  hasMutator,
  hasAwaitedType,
}) => {
  let footer = '';

  if (!noFunction) {
    footer += `return {${operationNames.join(',')}}};\n`;
  }

  if (hasMutator && !hasAwaitedType) {
    footer += `\ntype AwaitedInput<T> = PromiseLike<T> | T;\n
    type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
\n`;
  }

  for (const operationName of operationNames) {
    if (returnTypesToWrite.has(operationName)) {
      // Map.has ensures Map.get will not return undefined, but TS still complains
      // bug https://github.com/microsoft/TypeScript/issues/13086
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const func = returnTypesToWrite.get(operationName)!;
      footer += func(noFunction ? undefined : title) + '\n';
    }
  }

  return footer;
};

export const generateAxios = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  isFactoryMode = false,
) => {
  const imports = generateVerbImports(verbOptions);
  const implementation = generateAxiosImplementation(
    verbOptions,
    options,
    isFactoryMode,
  );

  return { implementation, imports };
};

// Factory mode generator - axios is injected as parameter
export const generateAxiosFactory: ClientBuilder = (verbOptions, options) => {
  const { implementation, imports } = generateAxios(verbOptions, options, true);
  return { implementation, imports };
};

// Non-injection mode generator - uses global axios import
export const generateAxiosNoInjection: ClientBuilder = (
  verbOptions,
  options,
) => {
  const { implementation, imports } = generateAxios(
    verbOptions,
    options,
    false,
  );
  return { implementation, imports };
};

export const generateAxiosFunctions: ClientBuilder = (verbOptions, options) => {
  const { implementation, imports } = generateAxios(verbOptions, options);

  return {
    implementation: 'export ' + implementation,
    imports,
  };
};

// axios client with factory pattern (axios injected as parameter)
const axiosClientBuilder: ClientGeneratorsBuilder = {
  client: generateAxiosFactory,
  header: generateAxiosHeader,
  dependencies: getAxiosFactoryDependencies,
  footer: generateAxiosFooter,
  title: generateAxiosTitle,
};

// axios client without injection (uses global axios import, original behavior)
const axiosClientNoInjectionBuilder: ClientGeneratorsBuilder = {
  client: generateAxiosNoInjection,
  header: generateAxiosHeaderNoInjection,
  dependencies: getAxiosDependencies,
  footer: generateAxiosFooter,
  title: generateAxiosTitle,
};

const axiosFunctionsClientBuilder: ClientGeneratorsBuilder = {
  client: generateAxiosFunctions,
  header: (options) => generateAxiosHeader({ ...options, noFunction: true }),
  dependencies: getAxiosDependencies,
  footer: (options) => generateAxiosFooter({ ...options, noFunction: true }),
  title: generateAxiosTitle,
};

export type AxiosBuilderOptions = {
  type?: 'axios' | 'axios-functions';
  httpClientInjection?: boolean;
};

export const builder =
  ({
    type = 'axios-functions',
    httpClientInjection = false,
  }: AxiosBuilderOptions = {}) =>
  () => {
    if (type === 'axios-functions') {
      return axiosFunctionsClientBuilder;
    }

    // For 'axios' type, check httpClientInjection option
    if (httpClientInjection) {
      return axiosClientBuilder;
    }

    // Default: no injection (original axios behavior)
    return axiosClientNoInjectionBuilder;
  };

export default builder;
