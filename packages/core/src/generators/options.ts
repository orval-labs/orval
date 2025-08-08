import {
  GeneratorMutator,
  GeneratorSchema,
  GetterBody,
  GetterQueryParam,
  GetterResponse,
  ParamsSerializerOptions,
  Verbs,
} from '../types';
import { getIsBodyVerb, isObject, stringify } from '../utils';

export const generateBodyOptions = (
  body: GetterBody,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
) => {
  if (isFormData && body.formData) {
    return '\n      formData,';
  }

  if (isFormUrlEncoded && body.formUrlEncoded) {
    return '\n      formUrlEncoded,';
  }

  if (body.implementation) {
    return `\n      ${body.implementation},`;
  }

  return '';
};

export const generateAxiosOptions = ({
  response,
  isExactOptionalPropertyTypes,
  queryParams,
  headers,
  requestOptions,
  hasSignal,
  isVue,
  isAngular,
  paramsSerializer,
  paramsSerializerOptions,
}: {
  response: GetterResponse;
  isExactOptionalPropertyTypes: boolean;
  queryParams?: GeneratorSchema;
  headers?: GeneratorSchema;
  requestOptions?: object | boolean;
  hasSignal: boolean;
  isVue: boolean;
  isAngular: boolean;
  paramsSerializer?: GeneratorMutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
}) => {
  const isRequestOptions = requestOptions !== false;
  if (
    !queryParams &&
    !headers &&
    !response.isBlob &&
    response.definition.success !== 'string'
  ) {
    if (isRequestOptions) {
      return 'options';
    }
    if (hasSignal) {
      return !isExactOptionalPropertyTypes
        ? 'signal'
        : '...(signal ? { signal } : {})';
    }
    return '';
  }

  let value = '';

  if (!isRequestOptions) {
    if (queryParams) {
      value += '\n        params,';
    }

    if (headers) {
      value += '\n        headers,';
    }

    if (hasSignal) {
      value += !isExactOptionalPropertyTypes
        ? '\n        signal,'
        : '\n        ...(signal ? { signal } : {}),';
    }
  }

  if (
    !isObject(requestOptions) ||
    !requestOptions.hasOwnProperty('responseType')
  ) {
    if (response.isBlob) {
      value += `\n        responseType: 'blob',`;
    } else if (response.definition.success === 'string') {
      value += `\n        responseType: 'text',`;
    }
  }

  if (isObject(requestOptions)) {
    value += `\n ${stringify(requestOptions)?.slice(1, -1)}`;
  }

  if (isRequestOptions) {
    value += '\n    ...options,';

    if (queryParams) {
      if (isVue) {
        value += '\n        params: {...unref(params), ...options?.params},';
      } else if (isAngular && paramsSerializer) {
        value += `\n        params: ${paramsSerializer.name}({...params, ...options?.params}),`;
      } else {
        value += '\n        params: {...params, ...options?.params},';
      }
    }

    if (headers) {
      value += '\n        headers: {...headers, ...options?.headers},';
    }
  }

  if (
    !isAngular &&
    queryParams &&
    (paramsSerializer || paramsSerializerOptions?.qs)
  ) {
    if (paramsSerializer) {
      value += `\n        paramsSerializer: ${paramsSerializer.name},`;
    } else {
      value += `\n        paramsSerializer: (params) => qs.stringify(params, ${JSON.stringify(
        paramsSerializerOptions!.qs,
      )}),`;
    }
  }

  return value;
};

export const generateOptions = ({
  route,
  body,
  headers,
  queryParams,
  response,
  verb,
  requestOptions,
  isFormData,
  isFormUrlEncoded,
  isAngular,
  isExactOptionalPropertyTypes,
  hasSignal,
  isVue,
  paramsSerializer,
  paramsSerializerOptions,
}: {
  route: string;
  body: GetterBody;
  headers?: GetterQueryParam;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  requestOptions?: object | boolean;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
  isAngular?: boolean;
  isExactOptionalPropertyTypes: boolean;
  hasSignal: boolean;
  isVue?: boolean;
  paramsSerializer?: GeneratorMutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
}) => {
  const bodyOptions = getIsBodyVerb(verb)
    ? generateBodyOptions(body, isFormData, isFormUrlEncoded)
    : '';

  const axiosOptions = generateAxiosOptions({
    response,
    queryParams: queryParams?.schema,
    headers: headers?.schema,
    requestOptions,
    isExactOptionalPropertyTypes,
    hasSignal,
    isVue: isVue ?? false,
    isAngular: isAngular ?? false,
    paramsSerializer,
    paramsSerializerOptions,
  });

  const options = axiosOptions ? `{${axiosOptions}}` : '';

  if (verb === Verbs.DELETE) {
    if (!bodyOptions) {
      return `\n      \`${route}\`,${
        axiosOptions === 'options' ? axiosOptions : options
      }\n    `;
    }

    return `\n      \`${route}\`,{${
      isAngular ? 'body' : 'data'
    }:${bodyOptions} ${
      axiosOptions === 'options' ? `...${axiosOptions}` : axiosOptions
    }}\n    `;
  }

  return `\n      \`${route}\`,${
    getIsBodyVerb(verb) ? bodyOptions || 'undefined,' : ''
  }${axiosOptions === 'options' ? axiosOptions : options}\n    `;
};

export const generateBodyMutatorConfig = (
  body: GetterBody,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
) => {
  if (isFormData && body.formData) {
    return ',\n       data: formData';
  }

  if (isFormUrlEncoded && body.formUrlEncoded) {
    return ',\n       data: formUrlEncoded';
  }

  if (body.implementation) {
    return `,\n      data: ${body.implementation}`;
  }

  return '';
};

export const generateQueryParamsAxiosConfig = (
  response: GetterResponse,
  isVue: boolean,
  queryParams?: GetterQueryParam,
) => {
  if (!queryParams && !response.isBlob) {
    return '';
  }

  let value = '';

  if (queryParams) {
    if (isVue) {
      value += ',\n        params: unref(params)';
    } else {
      value += ',\n        params';
    }
  }

  if (response.isBlob) {
    value += `,\n        responseType: 'blob'`;
  }

  return value;
};

export const generateMutatorConfig = ({
  route,
  body,
  headers,
  queryParams,
  response,
  verb,
  isFormData,
  isFormUrlEncoded,
  hasSignal,
  isExactOptionalPropertyTypes,
  isVue,
}: {
  route: string;
  body: GetterBody;
  headers?: GetterQueryParam;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
  hasSignal: boolean;
  isExactOptionalPropertyTypes: boolean;
  isVue?: boolean;
}) => {
  const bodyOptions = getIsBodyVerb(verb)
    ? generateBodyMutatorConfig(body, isFormData, isFormUrlEncoded)
    : '';

  const queryParamsOptions = generateQueryParamsAxiosConfig(
    response,
    isVue ?? false,
    queryParams,
  );

  const headerOptions = body.contentType
    ? `,\n      headers: {'Content-Type': '${body.contentType}', ${
        headers ? '...headers' : ''
      }}`
    : headers
      ? ',\n      headers'
      : '';

  return `{url: \`${route}\`, method: '${verb.toUpperCase()}'${headerOptions}${bodyOptions}${queryParamsOptions}${
    hasSignal
      ? `, ${
          isExactOptionalPropertyTypes
            ? '...(signal ? { signal }: {})'
            : 'signal'
        }`
      : ''
  }\n    }`;
};

export const generateMutatorRequestOptions = (
  requestOptions: boolean | object | undefined,
  hasSecondArgument: boolean,
) => {
  if (!hasSecondArgument) {
    return isObject(requestOptions)
      ? `{${stringify(requestOptions)?.slice(1, -1)}}`
      : '';
  }

  if (isObject(requestOptions)) {
    return `{${stringify(requestOptions)?.slice(1, -1)} ...options}`;
  }

  return 'options';
};

export const generateFormDataAndUrlEncodedFunction = ({
  body,
  formData,
  formUrlEncoded,
  isFormData,
  isFormUrlEncoded,
}: {
  body: GetterBody;
  formData?: GeneratorMutator;
  formUrlEncoded?: GeneratorMutator;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
}) => {
  if (isFormData && body.formData) {
    if (formData) {
      return `const formData = ${formData.name}(${body.implementation})`;
    }

    return body.formData;
  }

  if (isFormUrlEncoded && body.formUrlEncoded) {
    if (formUrlEncoded) {
      return `const formUrlEncoded = ${formUrlEncoded.name}(${body.implementation})`;
    }

    return body.formUrlEncoded;
  }

  return '';
};
