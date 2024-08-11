import {
  generateOptions,
  GeneratorVerbOptions,
  isSyntheticDefaultImportsAllow,
  toObjectString,
  GeneratorMutator,
  GetterResponse,
  pascal,
  GeneratorDependency,
  GeneratorOptions,
  OutputHttpClient,
  VERBS_WITH_BODY,
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
} from '@orval/core';

import { generateRequestFunction as generateFetchRequestFunction } from '@orval/fetch';

import {
  isVue,
  makeRouteSafe,
  vueUnRefParams,
  vueWrapTypeWithMaybeRef,
} from './utils';
import exp from 'constants';

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

export const generateQueryRequestFunction = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  isVue: boolean,
) => {
  if (options.context.output.httpClient === OutputHttpClient.AXIOS) {
    return generateAxiosRequestFunction(verbOptions, options, isVue);
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
    mutator,
    body,
    props: _props,
    verb,
    formData,
    formUrlEncoded,
    override,
    paramsSerializer,
  }: GeneratorVerbOptions,
  { route: _route, context }: GeneratorOptions,
  isVue: boolean,
) => {
  let props = _props;
  let route = _route;

  if (isVue) {
    props = vueWrapTypeWithMaybeRef(_props);
  }

  if (context.output?.urlEncodeParameters) {
    route = makeRouteSafe(route);
  }

  const isRequestOptions = override.requestOptions !== false;
  const isFormData = override.formData !== false;
  const isFormUrlEncoded = override.formUrlEncoded !== false;
  const hasSignal = !!override.query.signal;

  const isExactOptionalPropertyTypes =
    !!context.output.tsconfig?.compilerOptions?.exactOptionalPropertyTypes;
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);

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
      isBodyVerb,
      hasSignal,
      isExactOptionalPropertyTypes,
      isVue,
    });

    let bodyDefinition = body.definition.replace('[]', '\\[\\]');
    let propsImplementation =
      mutator?.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(`(\\w*):\\s?${bodyDefinition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    if (mutator.isHook) {
      return `${
        override.query.shouldExportMutatorHooks ? 'export ' : ''
      }const use${pascal(operationName)}Hook = () => {
        const ${operationName} = ${mutator.name}<${
          response.definition.success || 'unknown'
        }>();

        return useCallback((\n    ${propsImplementation}\n ${
          isRequestOptions && mutator.hasSecondArg
            ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<ReturnType<typeof ${mutator.name}>>,`
            : ''
        }${
          !isBodyVerb && hasSignal ? 'signal?: AbortSignal\n' : ''
        }) => {${bodyForm}
        return ${operationName}(
          ${mutatorConfig},
          ${requestOptions});
        }, [${operationName}])
      }
    `;
    }

    return `${override.query.shouldExportHttpClient ? 'export ' : ''}const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options${context.output.optionsParamRequired ? '' : '?'}: SecondParameter<typeof ${mutator.name}>,`
        : ''
    }${!isBodyVerb && hasSignal ? 'signal?: AbortSignal\n' : ''}) => {
      ${isVue ? vueUnRefParams(props) : ''}
      ${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions});
    }
  `;
  }

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

  const httpRequestFunctionImplementation = `export const ${operationName} = (\n    ${queryProps} ${optionsArgs} ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${bodyForm}
    ${isVue ? vueUnRefParams(props) : ''}
    return axios${
      !isSyntheticDefaultImportsAllowed ? '.default' : ''
    }.${verb}(${options});
  }
`;

  return httpRequestFunctionImplementation;
};

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

export const getQueryArgumentsRequestType = (
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  if (!mutator) {
    return httpClient === OutputHttpClient.AXIOS
      ? `axios?: AxiosRequestConfig`
      : 'fetch?: RequestInit';
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
  httpClient,
}: {
  isRequestOptions: boolean;
  mutator?: GeneratorMutator;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  httpClient: OutputHttpClient;
}) => {
  if (!mutator && isRequestOptions) {
    const options =
      httpClient === OutputHttpClient.AXIOS ? 'axiosOptions' : 'fetchOptions';

    if (!hasSignal) {
      return options;
    }

    return `{ ${
      isExactOptionalPropertyTypes ? '...(signal ? { signal } : {})' : 'signal'
    }, ...${options} }`;
  }

  if (mutator?.hasSecondArg && isRequestOptions) {
    if (!hasSignal) {
      return 'requestOptions';
    }

    return httpClient === OutputHttpClient.AXIOS
      ? 'requestOptions, signal'
      : '{ signal, ...requestOptions }';
  }

  if (hasSignal) {
    return 'signal';
  }

  return '';
};

export const getHookOptions = ({
  isRequestOptions,
  httpClient,
  mutator,
}: {
  isRequestOptions: boolean;
  httpClient: OutputHttpClient;
  mutator?: GeneratorMutator;
}) => {
  if (!isRequestOptions) {
    return '';
  }

  let value = 'const {query: queryOptions';

  if (!mutator) {
    const options =
      httpClient === OutputHttpClient.AXIOS
        ? ', axios: axiosOptions'
        : ', fetch: fetchOptions';

    value += options;
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
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  if (mutator) {
    return mutator.hasErrorType
      ? `${mutator.default ? pascal(operationName) : ''}ErrorType<${
          response.definition.errors || 'unknown'
        }>`
      : response.definition.errors || 'unknown';
  } else {
    return httpClient === OutputHttpClient.AXIOS
      ? `AxiosError<${response.definition.errors || 'unknown'}>`
      : `${response.definition.errors || 'unknown'}`;
  }
};

export const getHooksOptionImplementation = (
  isRequestOptions: boolean,
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  const options =
    httpClient === OutputHttpClient.AXIOS
      ? ', axios: axiosOptions'
      : ', fetch: fetchOptions';

  return isRequestOptions
    ? `const {mutation: mutationOptions${
        !mutator
          ? options
          : mutator?.hasSecondArg
            ? ', request: requestOptions'
            : ''
      }} = options ?? {};`
    : '';
};

export const getMutationRequestArgs = (
  isRequestOptions: boolean,
  httpClient: OutputHttpClient,
  mutator?: GeneratorMutator,
) => {
  const options =
    httpClient === OutputHttpClient.AXIOS ? 'axiosOptions' : 'fetchOptions';

  return isRequestOptions
    ? !mutator
      ? options
      : mutator?.hasSecondArg
        ? 'requestOptions'
        : ''
    : '';
};

export const getHttpFunctionQueryProps = (
  isVue: boolean,
  httpClient: OutputHttpClient,
  queryProperties: string,
) => {
  if (isVue && httpClient === OutputHttpClient.FETCH && queryProperties) {
    return `unref(${queryProperties})`;
  }

  return queryProperties;
};
