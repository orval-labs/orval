import {
  GetterBody,
  GetterParams,
  GetterProps,
  GetterPropType,
  GetterQueryParam,
} from '../types';
import { isUndefined, sortByPriority } from '../utils';

export const getProps = ({
  body,
  queryParams,
  params,
  headers,
}: {
  body: GetterBody;
  queryParams?: GetterQueryParam;
  params: GetterParams;
  headers?: GetterQueryParam;
}): GetterProps => {
  const bodyProp = {
    name: body.implementation,
    definition: `${body.implementation}: ${body.definition}`,
    implementation: `${body.implementation}: ${body.definition}`,
    default: false,
    required: true,
    type: GetterPropType.BODY,
  };

  const queryParamsProp = {
    name: 'params',
    definition: `params${queryParams?.isOptional ? '?' : ''}: ${
      queryParams?.schema.name
    }`,
    implementation: `params${queryParams?.isOptional ? '?' : ''}: ${
      queryParams?.schema.name
    }`,
    default: false,
    required: !isUndefined(queryParams?.isOptional)
      ? !queryParams?.isOptional
      : false,
    type: GetterPropType.QUERY_PARAM,
  };

  const headersProp = {
    name: 'headers',
    definition: `headers${headers?.isOptional ? '?' : ''}: ${
      headers?.schema.name
    }`,
    implementation: `headers${headers?.isOptional ? '?' : ''}: ${
      headers?.schema.name
    }`,
    default: false,
    required: !isUndefined(headers?.isOptional) ? !headers?.isOptional : false,
    type: GetterPropType.HEADER,
  };

  const props = [
    ...params.map((param) => ({ ...param, type: GetterPropType.PARAM })),
    ...(body.definition ? [bodyProp] : []),
    ...(queryParams ? [queryParamsProp] : []),
    ...(headers ? [headersProp] : []),
  ];

  const sortedProps = sortByPriority(props);

  return sortedProps;
};
