import { VERBS_WITH_BODY } from '../../constants';
import { Verbs } from '../../types';
import { GeneratorMutator, GeneratorSchema } from '../../types/generator';
import {
  GetterBody,
  GetterQueryParam,
  GetterResponse,
} from '../../types/getters';
import { isObject } from '../../utils/is';
import { stringify } from '../../utils/string';

export const generateBodyOptions = (
  body: GetterBody,
  verb: Verbs,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
) => {
  if (!VERBS_WITH_BODY.includes(verb)) {
    return '';
  }

  if (isFormData && body.formData) {
    return '\n      formData,';
  }

  if (isFormUrlEncoded && body.formUrlEncoded) {
    return '\n      formUrlEncoded,';
  }

  return `\n      ${body.implementation || 'undefined'},`;
};

export const generateAxiosOptions = (
  response: GetterResponse,
  queryParams?: GeneratorSchema,
  requestOptions?: object | boolean,
) => {
  const isRequestOptions = requestOptions !== false;
  if (!queryParams && !response.isBlob) {
    return isRequestOptions ? 'options' : '';
  }

  let value = '';

  if (queryParams) {
    value += '\n        params,';
  }

  if (
    response.isBlob &&
    (!isObject(requestOptions) ||
      !requestOptions.hasOwnProperty('responseType'))
  ) {
    value += `\n        responseType: 'blob',`;
  }

  if (isObject(requestOptions)) {
    value += `\n ${stringify(requestOptions)?.slice(1, -1)}`;
  }

  if (isRequestOptions) {
    value += '\n    ...options';
  }

  return value;
};

export const generateOptions = ({
  route,
  body,
  queryParams,
  response,
  verb,
  requestOptions,
  isFormData,
  isFormUrlEncoded,
}: {
  route: string;
  body: GetterBody;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  requestOptions?: object | boolean;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
}) => {
  const bodyOptions = generateBodyOptions(
    body,
    verb,
    isFormData,
    isFormUrlEncoded,
  );

  const axiosOptions = generateAxiosOptions(
    response,
    queryParams?.schema,
    requestOptions,
  );

  if (verb === Verbs.DELETE) {
    return `\n      \`${route}\`,{data:${bodyOptions} ${
      axiosOptions === 'options' ? `...${axiosOptions}` : axiosOptions
    }}\n    `;
  }

  return `\n      \`${route}\`,${bodyOptions}${
    axiosOptions === 'options' ? axiosOptions : `{${axiosOptions}}`
  }\n    `;
};

export const generateBodyMutatorConfig = (
  body: GetterBody,
  verb: Verbs,
  isFormData: boolean,
  isFormUrlEncoded: boolean,
) => {
  if (!VERBS_WITH_BODY.includes(verb)) {
    return '';
  }

  if (isFormData && body.formData) {
    return ',\n       data: formData';
  }

  if (isFormUrlEncoded && body.formUrlEncoded) {
    return ',\n       data: formUrlEncoded';
  }

  return `,\n      data: ${body.implementation || 'undefined'}`;
};

export const generateQueryParamsAxiosConfig = (
  response: GetterResponse,
  queryParams?: GeneratorSchema,
) => {
  if (!queryParams && !response.isBlob) {
    return '';
  }

  let value = ',';

  if (queryParams) {
    value += '\n        params,';
  }

  if (response.isBlob) {
    value += `\n        responseType: 'blob',`;
  }

  return value;
};

export const generateMutatorConfig = ({
  route,
  body,
  queryParams,
  response,
  verb,
  isFormData,
  isFormUrlEncoded,
}: {
  route: string;
  body: GetterBody;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
}) => {
  return `{url: \`${route}\`, method: '${verb}'${generateBodyMutatorConfig(
    body,
    verb,
    isFormData,
    isFormUrlEncoded,
  )}${generateQueryParamsAxiosConfig(response, queryParams?.schema)}\n    }`;
};

export const generateMutatorRequestOptions = (
  requestOptions: boolean | object | undefined,
  hasSecondArgument: boolean,
) => {
  if (!hasSecondArgument) {
    return isObject(requestOptions)
      ? stringify(requestOptions)?.slice(1, -1)
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
