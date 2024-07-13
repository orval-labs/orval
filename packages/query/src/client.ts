import {
  generateOptions,
  GeneratorVerbOptions,
  isSyntheticDefaultImportsAllow,
  toObjectString,
  GeneratorMutator,
  GetterResponse,
  pascal,
  GetterProps,
  ContextSpecs,
  GeneratorDependency,
  GeneratorOptions,
  OutputHttpClient,
} from '@orval/core';

import {
  generateRequestFunction as generateFetchRequestFunction,
  fetchResponseTypeName,
} from '@orval/fetch';

import { vueUnRefParams } from './utils';

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

export const generateRequestOptionsArguments = ({
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

export const generateQueryHttpRequestFunction = (
  verbOptions: GeneratorVerbOptions,
  context: ContextSpecs,
  options: GeneratorOptions,
  props: GetterProps,
  route: string,
  isVue: boolean,
  isRequestOptions: boolean,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
  hasSignal: boolean,
  isExactOptionalPropertyTypes: boolean,
  bodyForm: string,
) => {
  if (options.context.output.httpClient === OutputHttpClient.AXIOS) {
    return generateAxiosRequestFunction(
      verbOptions,
      context,
      props,
      route,
      isVue,
      isRequestOptions,
      isFormData,
      isFormUrlEncoded,
      hasSignal,
      isExactOptionalPropertyTypes,
      bodyForm,
    );
  } else {
    return generateFetchRequestFunction(verbOptions, options);
  }
};

export const generateAxiosRequestFunction = (
  {
    headers,
    queryParams,
    operationName,
    response,
    body,
    verb,
    paramsSerializer,
    override,
  }: GeneratorVerbOptions,
  context: ContextSpecs,
  props: GetterProps,
  route: string,
  isVue: boolean,
  isRequestOptions: boolean,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
  hasSignal: boolean,
  isExactOptionalPropertyTypes: boolean,
  bodyForm: string,
) => {
  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.output.tsconfig,
  );

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
    hasSignal,
    isVue: isVue,
  });

  const optionsArgs = generateRequestOptionsArguments({
    isRequestOptions,
    hasSignal,
  });

  const queryProps = toObjectString(props, 'implementation');

  return `export const ${operationName} = (\n    ${queryProps} ${optionsArgs} ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${bodyForm}
    ${isVue ? vueUnRefParams(props) : ''}
    return axios${
      !isSyntheticDefaultImportsAllowed ? '.default' : ''
    }.${verb}(${options});
  }
`;
};

export const getQueryArgumentsRequestType = (mutator?: GeneratorMutator) => {
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

export const getQueryOptions = ({
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

export const getHookOptions = ({
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

export const getQueryErrorType = (
  operationName: string,
  response: GetterResponse,
  mutator?: GeneratorMutator,
) => {
  let errorType = `AxiosError<${response.definition.errors || 'unknown'}>`;

  if (mutator) {
    errorType = mutator.hasErrorType
      ? `${mutator.default ? pascal(operationName) : ''}ErrorType<${
          response.definition.errors || 'unknown'
        }>`
      : response.definition.errors || 'unknown';
  }

  return errorType;
};

export const getHooksOptionImplementation = (
  isRequestOptions: boolean,
  mutator?: GeneratorMutator,
) => {
  return isRequestOptions
    ? `const {mutation: mutationOptions${
        !mutator
          ? `, axios: axiosOptions`
          : mutator?.hasSecondArg
            ? ', request: requestOptions'
            : ''
      }} = options ?? {};`
    : '';
};

export const getMutationRequestArgs = (
  isRequestOptions: boolean,
  mutator?: GeneratorMutator,
) => {
  return isRequestOptions
    ? !mutator
      ? `axiosOptions`
      : mutator?.hasSecondArg
        ? 'requestOptions'
        : ''
    : '';
};
