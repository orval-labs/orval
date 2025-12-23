import {
  type ClientHeaderBuilder,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
  type GeneratorDependency,
  type GeneratorMutator,
  type GeneratorOptions,
  type GeneratorVerbOptions,
  type GetterResponse,
  isSyntheticDefaultImportsAllow,
  OutputHttpClient,
  toObjectString,
} from '@orval/core';
import {
  fetchResponseTypeName,
  generateFetchHeader,
  generateRequestFunction as generateFetchRequestFunction,
} from '@orval/fetch';

export const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
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

export const generateSwrRequestFunction = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
) => {
  return options.context.output.httpClient === OutputHttpClient.AXIOS
    ? generateAxiosRequestFunction(verbOptions, options)
    : generateFetchRequestFunction(verbOptions, options);
};

const generateAxiosRequestFunction = (
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

    const propsImplementation =
      mutator.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(String.raw`(\w*):\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    const requestImplementation = `export const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<typeof ${mutator.name}>`
        : ''
    }) => {${bodyForm}
    return ${mutator.name}<${response.definition.success || 'unknown'}>(
    ${mutatorConfig},
    ${requestOptions});
  }
`;

    return requestImplementation;
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

  return `export const ${operationName} = (\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${bodyForm}
    return axios${
      isSyntheticDefaultImportsAllowed ? '' : '.default'
    }.${verb}(${options});
  }
`;
};

export const getSwrRequestOptions = (
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  if (!mutator) {
    return httpClient === OutputHttpClient.AXIOS
      ? 'axios?: AxiosRequestConfig'
      : 'fetch?: RequestInit';
  } else if (mutator.hasSecondArg) {
    return `request?: SecondParameter<typeof ${mutator.name}>`;
  } else {
    return '';
  }
};

export const getSwrErrorType = (
  response: GetterResponse,
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  if (mutator) {
    return mutator.hasErrorType
      ? `ErrorType<${response.definition.errors || 'unknown'}>`
      : response.definition.errors || 'unknown';
  } else {
    const errorType =
      httpClient === OutputHttpClient.AXIOS ? 'AxiosError' : 'Promise';

    return `${errorType}<${response.definition.errors || 'unknown'}>`;
  }
};

export const getSwrRequestSecondArg = (
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  if (!mutator) {
    return httpClient === OutputHttpClient.AXIOS
      ? 'axios: axiosOptions'
      : 'fetch: fetchOptions';
  } else if (mutator.hasSecondArg) {
    return 'request: requestOptions';
  } else {
    return '';
  }
};

export const getHttpRequestSecondArg = (
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  if (!mutator) {
    return httpClient === OutputHttpClient.AXIOS
      ? `axiosOptions`
      : `fetchOptions`;
  } else if (mutator.hasSecondArg) {
    return 'requestOptions';
  } else {
    return '';
  }
};

export const getSwrMutationFetcherOptionType = (
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  if (!mutator) {
    return httpClient === OutputHttpClient.AXIOS
      ? 'AxiosRequestConfig'
      : 'RequestInit';
  } else if (mutator.hasSecondArg) {
    return `SecondParameter<typeof ${mutator.name}>`;
  } else {
    return '';
  }
};

export const getSwrMutationFetcherType = (
  response: GetterResponse,
  httpClient: OutputHttpClient,
  includeHttpResponseReturnType: boolean | undefined,
  operationName: string,
  mutator?: GeneratorMutator,
) => {
  if (httpClient === OutputHttpClient.FETCH) {
    const responseType = fetchResponseTypeName(
      includeHttpResponseReturnType,
      response.definition.success,
      operationName,
    );

    return `Promise<${responseType}>`;
  } else if (mutator) {
    return `Promise<${response.definition.success || 'unknown'}>`;
  } else {
    return `Promise<AxiosResponse<${response.definition.success || 'unknown'}>>`;
  }
};

export const getSwrHeader: ClientHeaderBuilder = (params) => {
  return params.output.httpClient === OutputHttpClient.FETCH
    ? generateFetchHeader(params)
    : '';
};
