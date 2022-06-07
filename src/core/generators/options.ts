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
  isAngular,
}: {
  route: string;
  body: GetterBody;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  requestOptions?: object | boolean;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
  isAngular?: boolean;
}) => {
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);
  const bodyOptions = isBodyVerb
    ? generateBodyOptions(body, isFormData, isFormUrlEncoded)
    : '';

  const axiosOptions = generateAxiosOptions(
    response,
    queryParams?.schema,
    requestOptions,
  );

  if (verb === Verbs.DELETE) {
    if (!bodyOptions) {
      return `\n      \`${route}\`,${
        axiosOptions === 'options' ? axiosOptions : `{${axiosOptions}}`
      }\n    `;
    }

    return `\n      \`${route}\`,{${
      isAngular ? 'body' : 'data'
    }:${bodyOptions} ${
      axiosOptions === 'options' ? `...${axiosOptions}` : axiosOptions
    }}\n    `;
  }

  return `\n      \`${route}\`,${
    isBodyVerb ? bodyOptions || 'undefined,' : ''
  }${axiosOptions === 'options' ? axiosOptions : `{${axiosOptions}}`}\n    `;
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
  isBodyVerb,
  hasSignal,
}: {
  route: string;
  body: GetterBody;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  isFormData: boolean;
  isFormUrlEncoded: boolean;
  isBodyVerb: boolean;
  hasSignal: boolean;
}) => {
  const bodyOptions = isBodyVerb
    ? generateBodyMutatorConfig(body, isFormData, isFormUrlEncoded)
    : '';

  const queryParamsOptions = generateQueryParamsAxiosConfig(
    response,
    queryParams?.schema,
  );

  const headerOptions = body.contentType
    ? `,\n      headers: {'Content-Type': '${body.contentType}'}`
    : '';

  return `{url: \`${route}\`, method: '${verb}'${
    !isBodyVerb && hasSignal ? ', signal' : ''
  }${headerOptions}${bodyOptions}${queryParamsOptions}\n    }`;
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
