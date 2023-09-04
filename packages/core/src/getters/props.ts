import {
  ContextSpecs,
  GetterBody,
  GetterParams,
  GetterProps,
  GetterPropType,
  GetterQueryParam,
} from '../types';
import { isUndefined, pascal, sortByPriority } from '../utils';

export const getProps = ({
  body,
  queryParams,
  params,
  operationId,
  headers,
  context,
}: {
  body: GetterBody;
  queryParams?: GetterQueryParam;
  params: GetterParams;
  operationId: string;
  headers?: GetterQueryParam;
  context: ContextSpecs;
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

  let paramGetterProps: GetterProps;
  if (context.override.useNamedParameters && params.length > 0) {
    const parameterTypeName = `${pascal(operationId)}PathParameters`;

    const name = 'pathParams';

    // needs a special model
    const namedParametersTypeDefinition = `export type ${parameterTypeName} = {\n ${params
      .map((property) => property.definition)
      .join(',\n    ')},\n }`;

    const isOptional = params.every((param) => param.default);

    const implementation = `{ ${params
      .map((property) =>
        property.default ? property.implementation : property.name,
      )
      .join(', ')} }: ${parameterTypeName}${isOptional ? ' = {}' : ''}`;

    const destructured = `{ ${params
      .map((property) => property.name)
      .join(', ')} }`;

    paramGetterProps = [
      {
        type: GetterPropType.NAMED_PATH_PARAMS,
        name,
        definition: `${name}: ${parameterTypeName}`,
        implementation,
        default: false,
        destructured,
        required: true,
        schema: {
          name: parameterTypeName,
          model: namedParametersTypeDefinition,
          imports: params.flatMap((property) => property.imports),
        },
      },
    ];
  } else {
    paramGetterProps = params.map((param) => ({
      ...param,
      type: GetterPropType.PARAM,
    }));
  }

  const props = [
    ...paramGetterProps,
    ...(body.definition ? [bodyProp] : []),
    ...(queryParams ? [queryParamsProp] : []),
    ...(headers ? [headersProp] : []),
  ];

  const sortedProps = sortByPriority(props);

  return sortedProps;
};
