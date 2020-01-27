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
} from 'openapi3-ts';
import { generalJSTypes } from '../../constants/generalJsTypes';
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

/**
 * Generate a orval component from openapi operation specs
 *
 * @param operation
 * @param verb
 * @param route
 * @param baseUrl
 * @param operationIds - List of `operationId` to check duplication
 */
const generateApiCalls = (
  operation: OperationObject,
  verb: string,
  route: string,
  parameters: Array<ReferenceObject | ParameterObject> = [],
  schemasComponents?: ComponentsObject,
): {
  value: string;
  definition: string;
  imports: string[];
  queryParamDefinition?: {
    name: string;
    model: string;
    imports: string[];
  };
} => {
  if (!operation.operationId) {
    throw new Error(`Every path must have a operationId - No operationId set for ${verb} ${route}`);
  }

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

  const responseTypes = getResReqTypes(Object.entries(operation.responses).filter(isOk)).join(' | ');
  const requestBodyTypes = getResReqTypes([['body', operation.requestBody!]]).join(' | ');
  let imports: string[] = [responseTypes, requestBodyTypes];
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

  const queryParamsTypes = getQueryParamsTypes({ queryParams });
  const queryParamsImports = queryParamsTypes.reduce<string[]>((acc, { imports = [] }) => [...acc, ...imports], []);
  const queryParamsDefinitioName = `${camel(componentName)}Params`;

  if (queryParams.length) {
    imports = [...imports, queryParamsDefinitioName];
  }

  const queryParamDefinition = {
    name: queryParamsDefinitioName,
    model: `export type ${queryParamsDefinitioName} = { ${queryParamsTypes
      .map(({ definition }) => definition)
      .join(', ')} }`,
    imports: queryParamsImports,
  };

  const propsDefinition = sortParams([
    ...getParamsTypes({ params: paramsInPath, pathParams, operation }),
    ...(requestBodyTypes
      ? [{ definition: `${camel(requestBodyTypes)}: ${requestBodyTypes}`, default: false, required: false }]
      : []),
    ...(queryParams.length
      ? [
          {
            definition: `params?: ${queryParamsDefinitioName}`,
            default: false,
            required: false,
          },
        ]
      : []),
  ])
    .map(({ definition }) => definition)
    .join(', ');

  const props = sortParams([
    ...getParamsTypes({ params: paramsInPath, pathParams, operation, type: 'implementation' }),
    ...(requestBodyTypes
      ? [{ definition: `${camel(requestBodyTypes)}: ${requestBodyTypes}`, default: false, required: false }]
      : []),
    ...(queryParams.length
      ? [
          {
            definition: `params?: ${queryParamsDefinitioName}`,
            default: false,
            required: false,
          },
        ]
      : []),
  ])
    .map(({ definition }) => definition)
    .join(', ');

  const definition = `
  ${operation.summary ? '// ' + operation.summary : ''}
  ${camel(componentName)}(${propsDefinition}): AxiosPromise<${
    needAResponseComponent ? componentName + 'Response' : responseTypes
  }>`;

  const output = `  ${camel(componentName)}(${props}): AxiosPromise<${
    needAResponseComponent ? componentName + 'Response' : responseTypes
  }> {
    return axios.${verb}(\`${route}\` ${requestBodyTypes ? `, ${camel(requestBodyTypes)}` : ''} ${
    queryParams.length || responseTypes === 'BlobPart'
      ? `,
      {
        ${queryParams.length ? 'params' : ''}${queryParams.length && responseTypes === 'BlobPart' ? ',' : ''}${
          responseTypes === 'BlobPart'
            ? `responseType: 'arraybuffer',
        headers: {
          Accept: 'application/pdf',
        },`
            : ''
        }
      }`
      : ''
  });
  },
`;

  return {
    value: output,
    definition,
    imports,
    ...(queryParams.length ? { queryParamDefinition } : {}),
  };
};

export const generateApi = (specs: OpenAPIObject) => {
  let imports: string[] = [];
  let queryParamDefinitions: Array<{ name: string; model: string; imports?: string[] }> = [];
  let definition = '';
  definition += `export interface ${pascal(specs.info.title)} {`;
  let value = '';
  value += `export const get${pascal(specs.info.title)} = (axios: AxiosInstance): ${pascal(specs.info.title)} => ({\n`;
  Object.entries(specs.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      if (['get', 'post', 'patch', 'put', 'delete'].includes(verb)) {
        const call = generateApiCalls(operation, verb, route, verbs.parameters, specs.components);
        if (call.queryParamDefinition) {
          queryParamDefinitions = [...queryParamDefinitions, call.queryParamDefinition];
        }
        imports = [...imports, ...call.imports];
        definition += `${call.definition};`;
        value += call.value;
      }
    });
  });
  definition += '\n};';
  value += '})';

  return {
    output: `${definition}\n\n${value}`,
    imports: uniq(imports.filter(imp => imp && !generalJSTypes.includes(imp.toLocaleLowerCase()))),
    queryParamDefinitions,
  };
};
