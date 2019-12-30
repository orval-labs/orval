import { camel, pascal } from 'case';
import get from 'lodash/get';
import groupBy from 'lodash/groupBy';
import {
  ComponentsObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts';
import { generalJSTypes } from '../../constants/generalJsTypes';
import { getMockDefinition } from '../getters/getMockDefinition';
import { getParamsInPath } from '../getters/getParamsInPath';
import { getParamsTypes } from '../getters/getParamsTypes';
import { getQueryParamsTypes } from '../getters/getQueryParamsTypes';
import { getResReqTypes } from '../getters/getResReqTypes';
import { isReference } from '../isReference';

const sortParams = (arr: { default?: boolean; required?: boolean; definition: string }[]) =>
  arr.sort((a, b) => {
    if (a.default) {
      return 1;
    }

    if (b.default) {
      return -1;
    }

    if (a.required && b.required) {
      return 1;
    }

    if (a.required) {
      return -1;
    }

    if (b.required) {
      return 1;
    }
    return 1;
  });

const generateMocksCalls = (
  operation: OperationObject,
  verb: string,
  route: string,
  parameters: Array<ReferenceObject | ParameterObject> = [],
  schemasComponents?: ComponentsObject,
) => {
  route = route.replace(/\{/g, '${'); // `/pet/{id}` => `/pet/${id}`

  // Remove the last param of the route if we are in the DELETE case
  let lastParamInTheRoute: string | null = null;
  if (verb === 'delete') {
    const lastParamInTheRouteRegExp = /\/\$\{(\w+)\}$/;
    lastParamInTheRoute = (route.match(lastParamInTheRouteRegExp) || [])[1];
    route = route.replace(lastParamInTheRouteRegExp, ''); // `/pet/${id}` => `/pet`
  }
  const componentName = pascal(operation.operationId!);

  const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) => statusCode.toString().startsWith('2');

  const allResponseTypes = getResReqTypes(Object.entries(operation.responses).filter(isOk));

  const responseTypes = allResponseTypes.join(' | ');

  const requestBodyTypes = getResReqTypes([['body', operation.requestBody!]]).join(' | ');
  const needAResponseComponent = responseTypes.includes('{');

  const paramsInPath = getParamsInPath(route).filter(param => !(verb === 'delete' && param === lastParamInTheRoute));
  const { query: queryParams = [], path: pathParams = [] } = groupBy(
    [...parameters, ...(operation.parameters || [])].map<ParameterObject>(p => {
      if (isReference(p)) {
        return get(schemasComponents, p.$ref.replace('#/components/', '').replace('/', '.'));
      } else {
        return p;
      }
    }),
    'in',
  );

  const props = sortParams([
    ...getParamsTypes({ params: paramsInPath, pathParams, operation, type: 'implementation' }),
    ...(requestBodyTypes
      ? [{ definition: `${camel(requestBodyTypes)}: ${requestBodyTypes}`, default: false, required: false }]
      : []),
    ...(queryParams.length
      ? [
          {
            definition: `params?: { ${getQueryParamsTypes({ queryParams, type: 'implementation' })
              .map(({ definition }) => definition)
              .join(', ')} }`,
            default: false,
            required: false,
          },
        ]
      : []),
  ])
    .map(({ definition }) => definition)
    .join(', ');

  const schemas = Object.entries(schemasComponents?.schemas || []).reduce(
    (acc, [name, type]) => ({ ...acc, [name]: type }),
    {},
  ) as { [key: string]: SchemaObject };

  const mocks = allResponseTypes.map(type => {
    if (!type) {
      return 'Promise.resolve()';
    }

    if (!generalJSTypes.includes(type)) {
      const schema = schemas[type];
      if (!schema) {
        return 'Promise.resolve()';
      }

      return `Promise.resolve({data: ${getMockDefinition(schema, schemas).value}})`;
    }

    return 'Promise.resolve()';
  });

  const mocksDefinition = '[' + mocks.join(', ') + ']';

  const output = `  ${camel(componentName)}(${props}): AxiosPromise<${
    needAResponseComponent ? componentName + 'Response' : responseTypes
  }> {
    return ${mocks.length > 1 ? `faker.helpers.randomize(${mocksDefinition})` : mocks[0]}
  },
`;

  return { value: output };
};

export const generateMocks = (specs: OpenAPIObject) => {
  let value = '';

  value += `export const get${pascal(specs.info.title)}Mock = (): ${pascal(specs.info.title)} => ({\n`;
  Object.entries(specs.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      if (['get', 'post', 'patch', 'put', 'delete'].includes(verb)) {
        const call = generateMocksCalls(operation, verb, route, verbs.parameters, specs.components);
        value += call.value;
      }
    });
  });
  value += '})';

  return {
    output: `\n\n${value}`,
  };
};
