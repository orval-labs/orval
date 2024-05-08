import {
  ContextSpecs,
  GetterBody,
  GetterParams,
  GetterProps,
  GetterPropType,
  GetterQueryParam,
  NormalizedOutputOptions,
} from '../types';
import { isUndefined, pascal, sortByPriority } from '../utils';

export const getProps = ({
  body,
  queryParams,
  params,
  operationName,
  headers,
  context,
  output,
}: {
  body: GetterBody;
  queryParams?: GetterQueryParam;
  params: GetterParams;
  operationName: string;
  headers?: GetterQueryParam;
  context: ContextSpecs;
  output: NormalizedOutputOptions;
}): GetterProps => {
  const bodyProp = {
    name: body.implementation,
    definition: `${body.implementation}${body.isOptional || output.allParamsOptional ? '?' : ''}: ${body.definition}`,
    implementation: `${body.implementation}${body.isOptional || output.allParamsOptional ? '?' : ''}: ${body.definition}`,
    default: false,
    required: output.allParamsOptional ? false : !body.isOptional,
    type: GetterPropType.BODY,
  };

  const queryParamsProp = {
    name: 'params',
    definition: `params${queryParams?.isOptional || output.allParamsOptional ? '?' : ''}: ${
      queryParams?.schema.name
    }`,
    implementation: `params${queryParams?.isOptional || output.allParamsOptional ? '?' : ''}: ${
      queryParams?.schema.name
    }`,
    default: false,
    required: output.allParamsOptional
      ? false
      : !isUndefined(queryParams?.isOptional)
        ? !queryParams?.isOptional
        : false,
    type: GetterPropType.QUERY_PARAM,
  };

  const headersProp = {
    name: 'headers',
    definition: `headers${headers?.isOptional || output.allParamsOptional ? '?' : ''}: ${
      headers?.schema.name
    }`,
    implementation: `headers${headers?.isOptional || output.allParamsOptional ? '?' : ''}: ${
      headers?.schema.name
    }`,
    default: false,
    required: output.allParamsOptional
      ? false
      : !isUndefined(headers?.isOptional)
        ? !headers?.isOptional
        : false,
    type: GetterPropType.HEADER,
  };

  let paramGetterProps: GetterProps;
  if (context.output.override.useNamedParameters && params.length > 0) {
    const parameterTypeName = `${pascal(operationName)}PathParameters`;

    const name = 'pathParams';

    // needs a special model
    const namedParametersTypeDefinition = `export type ${parameterTypeName} = {\n ${params
      .map((property) => property.definition)
      .join(',\n    ')},\n }`;

    const isOptional = params.every((param) => param.default);

    const implementation = `{ ${params
      .map((property) =>
        property.default
          ? `${property.name} = ${property.default}` // if we use property.implementation, we will get `{ version: number = 1 }: ListPetsPathParameters = {}` which isn't valid
          : property.name,
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
