import { VERBS_WITH_BODY } from '../../constants';
import { Verbs } from '../../types';
import { GeneratorSchema } from '../../types/generator';
import {
  GetterBody,
  GetterQueryParam,
  GetterResponse,
} from '../../types/getters';

export const generateBodyOptions = (body: GetterBody, verb: Verbs) => {
  if (!VERBS_WITH_BODY.includes(verb)) {
    return '';
  }

  if (body.isBlob) {
    return '\n      formData,';
  }

  return `\n      ${body.implementation || 'undefined'},`;
};

export const generateQueryParamsOptions = (
  response: GetterResponse,
  queryParams?: GeneratorSchema,
) => {
  if (!queryParams && !response.isBlob) {
    return '';
  }

  let value = '\n      {';

  if (queryParams) {
    value += '\n        params,';
  }

  if (response.isBlob) {
    value += `\n        responseType: 'blob',`;
  }

  value += '\n      },';

  return value;
};

export const generateOptions = ({
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
  return `\n      \`${route}\`,${generateBodyOptions(
    body,
    verb,
  )}${generateQueryParamsOptions(response, queryParams?.schema)}\n    `;
};
