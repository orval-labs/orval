import { VERBS_WITH_BODY } from '../../constants';
import { Verbs } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import {
  GetterBody,
  GetterQueryParam,
  GetterResponse,
} from '../../types/getters';
import { isObject } from '../../utils/is';
import { stringify } from '../../utils/string';

export const generateBodyOptions = (body: GetterBody, verb: Verbs) => {
  if (!VERBS_WITH_BODY.includes(verb)) {
    return '';
  }

  if (body.formData) {
    return '\n      formData,';
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

  let value = '\n      {';

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

  value += ' },';

  return value;
};

export const generateOptions = ({
  route,
  body,
  queryParams,
  response,
  verb,
  requestOptions,
}: {
  route: string;
  body: GetterBody;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
  requestOptions?: object | boolean;
}) => {
  return `\n      \`${route}\`,${generateBodyOptions(
    body,
    verb,
  )}${generateAxiosOptions(
    response,
    queryParams?.schema,
    requestOptions,
  )}\n    `;
};

export const generateBodyMutatorConfig = (body: GetterBody, verb: Verbs) => {
  if (!VERBS_WITH_BODY.includes(verb)) {
    return '';
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
}: {
  route: string;
  body: GetterBody;
  queryParams?: GetterQueryParam;
  response: GetterResponse;
  verb: Verbs;
}) => {
  return `{url: \`${route}\`, method: '${verb}'${generateBodyMutatorConfig(
    body,
    verb,
  )}${generateQueryParamsAxiosConfig(response, queryParams?.schema)}\n    }`;
};
