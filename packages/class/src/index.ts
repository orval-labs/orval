import {
  ClientBuilder,
  ClientDependenciesBuilder,
  ClientFooterBuilder,
  ClientGeneratorsBuilder,
  ClientHeaderBuilder,
  ClientTitleBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  generateVerbImports,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
  pascal,
  sanitize,
  toObjectString
} from '@orval/core';

const AXIOS_CLASS_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      { name: 'Axios', values: true },
      { name: 'AxiosResponse', values: true },
      { name: 'AxiosRequestConfig', values: true },
    ],
    dependency: 'axios',
  },
];

const returnTypesToWrite: Map<string, string> = new Map();

export const getAxiosClassDependencies: ClientDependenciesBuilder = () =>
  AXIOS_CLASS_DEPENDENCIES;

export const generateAxiosClassTitle: ClientTitleBuilder = (title) => {
  const sanTitle = sanitize(title);
  return `${pascal(sanTitle)}Client`;
};

export const generateAxiosClassHeader: ClientHeaderBuilder = ({
  title,
  isRequestOptions,
  isMutator,
}) => `
${isRequestOptions && isMutator
    ? `// eslint-disable-next-line
    type ThirdParameter<T extends (...args: any) => any> = T extends (
  config: any,
  httpClient: any,
  args: infer P,
) => any
  ? P
  : never;`
    : ''
  }

export class ${title} {
  constructor(
    private axios: Axios,
  ) {}`;

export const generateAxiosClassFooter: ClientFooterBuilder = ({
  operationNames,
}) => {
  let footer = '};\n\n';

  operationNames.forEach((operationName) => {
    if (returnTypesToWrite.has(operationName)) {
      footer += returnTypesToWrite.get(operationName) + '\n';
    }
  });

  return footer;
};

const generateImplementation = (
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
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData.disabled === false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;
  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  const dataType = response.definition.success || 'unknown';

  returnTypesToWrite.set(
    operationName,
    `export type ${pascal(
      operationName,
    )}ClientResult = NonNullable<${dataType}>`,
  );

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
        override?.requestOptions,
        mutator.hasThirdArg,
      )
      : '';

    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
          new RegExp(`(\\w*):\\s?${body.definition}`),
          `$1: ${mutator.bodyTypeName}<${body.definition}>`,
        )
        : toObjectString(props, 'implementation');

    return ` ${operationName}<TData = ${dataType}>(\n    ${propsImplementation}\n ${isRequestOptions && mutator.hasThirdArg
      ? `options?: ThirdParameter<typeof ${mutator.name}>`
      : ''
      }) {${bodyForm}
      return ${mutator.name}<TData>(
      ${mutatorConfig},
      this.axios,
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
    isAngular: true,
    isExactOptionalPropertyTypes,
    hasSignal: false,
  });

  return ` ${operationName}<TData = ${dataType}>(\n    ${toObjectString(
    props,
    'implementation',
  )} ${isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
    }  ): Promise<AxiosResponse<TData>>  {${bodyForm}
    return this.axios.${verb}<TData>(${options});
  }
`;
};

export const generateAxiosClass: ClientBuilder = (verbOptions, options) => {
  const imports = generateVerbImports(verbOptions);
  const implementation = generateImplementation(verbOptions, options);

  return { implementation, imports };
};

const axiosClassClientBuilder: ClientGeneratorsBuilder = {
  client: generateAxiosClass,
  header: generateAxiosClassHeader,
  dependencies: getAxiosClassDependencies,
  footer: generateAxiosClassFooter,
  title: generateAxiosClassTitle,
};

export const builder = () => () => axiosClassClientBuilder;

export default builder;
