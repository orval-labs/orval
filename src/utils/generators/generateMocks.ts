import { camel, pascal } from 'case';
import get from 'lodash/get';
import groupBy from 'lodash/groupBy';
import uniq from 'lodash/uniq';
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
import { MockOptions } from '../../types';
import { getMockDefinition } from '../getters/getMockDefinition';
import { getParamsInPath } from '../getters/getParamsInPath';
import { getParamsTypes } from '../getters/getParamsTypes';
import { getQueryParamsTypes } from '../getters/getQueryParamsTypes';
import { getResReqTypes } from '../getters/getResReqTypes';
import { isReference } from '../isReference';
import { stringify } from '../stringify';

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

const generateMocksCalls = ({
  operation,
  verb,
  route,
  specs,
  parameters = [],
  schemasComponents,
  mockOptions,
}: {
  operation: OperationObject;
  verb: string;
  route: string;
  specs: OpenAPIObject;
  parameters?: Array<ReferenceObject | ParameterObject>;
  schemasComponents?: ComponentsObject;
  mockOptions?: MockOptions;
}) => {
  if (!operation.operationId) {
    throw new Error(`Every path must have a operationId - No operationId set for ${verb} ${route}`);
  }

  const { operationId, responses, requestBody } = operation;

  route = route.replace(/\{/g, '${'); // `/pet/{id}` => `/pet/${id}`

  // Remove the last param of the route if we are in the DELETE case
  let lastParamInTheRoute: string | null = null;
  if (verb === 'delete') {
    const lastParamInTheRouteRegExp = /\/\$\{(\w+)\}$/;
    lastParamInTheRoute = (route.match(lastParamInTheRouteRegExp) || [])[1];
    route = route.replace(lastParamInTheRouteRegExp, ''); // `/pet/${id}` => `/pet`
  }
  const componentName = pascal(operationId!);

  const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) => statusCode.toString().startsWith('2');

  const allResponseTypes = getResReqTypes(Object.entries(responses).filter(isOk));

  const responseTypes = allResponseTypes.join(' | ');

  const requestBodyTypes = getResReqTypes([['body', requestBody!]]).join(' | ');
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

  const toAxiosPromise = (value?: unknown) =>
    `Promise.resolve(${value}).then(data => ({data})) as AxiosPromise<${
      needAResponseComponent ? componentName + 'Response' : responseTypes
    }>`;

  const schemas = Object.entries(schemasComponents?.schemas || []).reduce(
    (acc, [name, type]) => ({ ...acc, [name]: type }),
    {},
  ) as { [key: string]: SchemaObject };

  let imports: string[] = [];

  const mockOptionsWithoutFunc = {
    ...mockOptions,
    ...(mockOptions?.properties
      ? {
          properties:
            typeof mockOptions.properties === 'function' ? mockOptions.properties(specs) : mockOptions.properties,
        }
      : {}),
    ...(mockOptions?.responses
      ? {
          responses: Object.entries(mockOptions.responses).reduce(
            (acc, [key, value]) => ({
              ...acc,
              [key]: {
                ...value,
                ...(value.properties
                  ? {
                      properties: typeof value.properties === 'function' ? value.properties(specs) : value.properties,
                    }
                  : {}),
              },
            }),
            {},
          ),
        }
      : {}),
  };

  const mocks = allResponseTypes.map(type => {
    const defaultResponse = toAxiosPromise(undefined);

    if (!type) {
      return defaultResponse;
    }

    if (!generalJSTypes.includes(type)) {
      const schema = { name: type, ...schemas[type] };
      if (!schema) {
        return defaultResponse;
      }

      const definition = getMockDefinition({ item: schema, schemas, mockOptions: mockOptionsWithoutFunc, operationId });

      if (imports) {
        imports = [...imports, ...definition.imports];
      }

      return toAxiosPromise(definition.value);
    }

    return defaultResponse;
  });

  const mocksDefinition = '[' + mocks.join(', ') + ']';

  const mockData =
    typeof mockOptions?.responses?.[operationId]?.data === 'function'
      ? `(${mockOptions?.responses?.[operationId]?.data})()`
      : stringify(mockOptions?.responses?.[operationId]?.data);

  const output = `  ${camel(componentName)}(${props}): AxiosPromise<${
    needAResponseComponent ? componentName + 'Response' : responseTypes
  }> {
    return ${
      mockData ? toAxiosPromise(mockData) : mocks.length > 1 ? `faker.helpers.randomize(${mocksDefinition})` : mocks[0]
    }
  },
`;

  return { value: output, imports };
};

export const generateMocks = (specs: OpenAPIObject, mockOptions?: MockOptions) => {
  let value = '';
  let imports: string[] = [];

  value += `export const get${pascal(specs.info.title)}Mock = (): ${pascal(specs.info.title)} => ({\n`;
  Object.entries(specs.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      if (['get', 'post', 'patch', 'put', 'delete'].includes(verb)) {
        const call = generateMocksCalls({
          operation,
          verb,
          route,
          parameters: verbs.parameters,
          schemasComponents: specs.components,
          mockOptions,
          specs,
        });
        value += call.value;
        imports = [...imports, ...call.imports];
      }
    });
  });
  value += '})';

  return {
    output: `\n\n${value}`,
    imports: uniq(imports.filter(imp => imp && !generalJSTypes.includes(imp.toLocaleLowerCase()))),
  };
};
