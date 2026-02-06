import {
  type GeneratorMutator,
  type GeneratorSchema,
  type GetterBody,
  type GetterQueryParam,
  type GetterResponse,
  type ParamsSerializerOptions,
  Verbs,
} from '../types';
import { getIsBodyVerb, isObject, stringify } from '../utils';

interface GenerateFormDataAndUrlEncodedFunctionOptions {
  body: GetterBody;
  formData?: GeneratorMutator;
  formUrlEncoded?: GeneratorMutator;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
}

export function generateBodyOptions(
  body: GetterBody,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
) {
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
}

interface GenerateAxiosOptions {
  response: GetterResponse;
  isExactOptionalPropertyTypes: boolean;
  queryParams?: GeneratorSchema;
  headers?: GeneratorSchema;
  requestOptions?: object | boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
  isVue: boolean;
  isAngular: boolean;
  paramsSerializer?: GeneratorMutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
}

export function generateAxiosOptions({
  response,
  isExactOptionalPropertyTypes,
  queryParams,
  headers,
  requestOptions,
  hasSignal,
  hasSignalParam = false,
  isVue,
  isAngular,
  paramsSerializer,
  paramsSerializerOptions,
}: GenerateAxiosOptions) {
  const isRequestOptions = requestOptions !== false;
  // Use querySignal if API has a param named "signal" to avoid conflict
  const signalVar = hasSignalParam ? 'querySignal' : 'signal';
  const signalProp = hasSignalParam ? `signal: ${signalVar}` : 'signal';

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
      return isExactOptionalPropertyTypes
        ? `...(${signalVar} ? { ${signalProp} } : {})`
        : signalProp;
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
      value += isExactOptionalPropertyTypes
        ? `\n        ...(${signalVar} ? { ${signalProp} } : {}),`
        : `\n        ${signalProp},`;
    }
  }

  if (
    !isObject(requestOptions) ||
    !requestOptions.hasOwnProperty('responseType')
  ) {
    if (response.isBlob) {
      value += `\n        responseType: 'blob',`;
    } else if (response.contentTypes.at(0) === 'text/plain') {
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
    value += paramsSerializer
      ? `\n        paramsSerializer: ${paramsSerializer.name},`
      : `\n        paramsSerializer: (params) => qs.stringify(params, ${JSON.stringify(
          paramsSerializerOptions!.qs,
        )}),`;
  }

  return value;
}

interface GenerateOptionsOptions {
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
  hasSignalParam?: boolean;
  isVue?: boolean;
  paramsSerializer?: GeneratorMutator;
  paramsSerializerOptions?: ParamsSerializerOptions;
}

export function generateOptions({
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
  hasSignalParam,
  isVue,
  paramsSerializer,
  paramsSerializerOptions,
}: GenerateOptionsOptions) {
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
    hasSignalParam,
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
}

export function generateBodyMutatorConfig(
  body: GetterBody,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
) {
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
}

export function generateQueryParamsAxiosConfig(
  response: GetterResponse,
  isVue: boolean,
  queryParams?: GetterQueryParam,
) {
  if (!queryParams && !response.isBlob) {
    return '';
  }

  let value = '';

  if (queryParams) {
    value += isVue ? ',\n        params: unref(params)' : ',\n        params';
  }

  if (response.isBlob) {
    value += `,\n        responseType: 'blob'`;
  }

  return value;
}

interface GenerateMutatorConfigOptions {
  route: string;
  body: GetterBody;
  headers?: GetterQueryParam;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
  hasSignal: boolean;
  hasSignalParam?: boolean;
  isExactOptionalPropertyTypes: boolean;
  isVue?: boolean;
}

export function generateMutatorConfig({
  route,
  body,
  headers,
  queryParams,
  response,
  verb,
  isFormData,
  isFormUrlEncoded,
  hasSignal,
  hasSignalParam = false,
  isExactOptionalPropertyTypes,
  isVue,
}: GenerateMutatorConfigOptions) {
  const bodyOptions = getIsBodyVerb(verb)
    ? generateBodyMutatorConfig(body, isFormData, isFormUrlEncoded)
    : '';

  const queryParamsOptions = generateQueryParamsAxiosConfig(
    response,
    isVue ?? false,
    queryParams,
  );

  const ignoreContentTypes = ['multipart/form-data'];
  const shouldSetContentType =
    body.contentType && !ignoreContentTypes.includes(body.contentType);

  const headerOptions = shouldSetContentType
    ? `,\n      headers: {'Content-Type': '${body.contentType}', ${
        headers ? '...headers' : ''
      }}`
    : headers
      ? ',\n      headers'
      : '';

  // Use querySignal if API has a param named "signal" to avoid conflict
  const signalVar = hasSignalParam ? 'querySignal' : 'signal';
  const signalProp = hasSignalParam ? `signal: ${signalVar}` : 'signal';

  return `{url: \`${route}\`, method: '${verb.toUpperCase()}'${headerOptions}${bodyOptions}${queryParamsOptions}${
    hasSignal
      ? `, ${
          isExactOptionalPropertyTypes
            ? `...(${signalVar} ? { ${signalProp} }: {})`
            : signalProp
        }`
      : ''
  }\n    }`;
}

export function generateMutatorRequestOptions(
  requestOptions: boolean | object | undefined,
  hasSecondArgument: boolean,
) {
  if (!hasSecondArgument) {
    return isObject(requestOptions)
      ? `{${stringify(requestOptions)?.slice(1, -1)}}`
      : '';
  }

  if (isObject(requestOptions)) {
    return `{${stringify(requestOptions)?.slice(1, -1)} ...options}`;
  }

  return 'options';
}

export function generateFormDataAndUrlEncodedFunction({
  body,
  formData,
  formUrlEncoded,
  isFormData,
  isFormUrlEncoded,
}: GenerateFormDataAndUrlEncodedFunctionOptions) {
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
}
