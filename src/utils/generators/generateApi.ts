import {camel, pascal} from 'case';
import get from 'lodash/get';
import groupBy from 'lodash/groupBy';
import {
  ComponentsObject,
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  ResponseObject
} from 'openapi3-ts';
import {join} from 'path';
import {OverrideOptions} from '../../types';
import {
  generalJSTypesWithArray,
  generalTypesFilter
} from '../generalTypesFilter';
import {getParamsInPath} from '../getters/getParamsInPath';
import {getParamsTypes} from '../getters/getParamsTypes';
import {getQueryParamsTypes} from '../getters/getQueryParamsTypes';
import {getResReqTypes} from '../getters/getResReqTypes';
import {isReference} from '../isReference';
import {sortParams} from '../sortParams';

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
  override?: OverrideOptions
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
    throw new Error(
      `Every path must have a operationId - No operationId set for ${verb} ${route}`
    );
  }

  route = route.replace(/\{/g, '${'); // `/pet/{id}` => `/pet/${id}`

  const operationOptions = override?.operations?.[operation.operationId];

  const transformer = operationOptions?.transformer
    ? require(join(process.cwd(), operationOptions.transformer))
    : undefined;

  const componentName = pascal(operation.operationId);

  const isOk = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
    statusCode.toString().startsWith('2');

  let imports: string[] = [];

  // gesture response types
  const allResponseTypes = getResReqTypes(
    Object.entries(operation.responses).filter(isOk)
  );
  const allResponseTypesImports = allResponseTypes.reduce<string[]>(
    (acc, {imports = []}) => [...acc, ...imports],
    []
  );
  imports = [...imports, ...allResponseTypesImports];
  const responseTypes = allResponseTypes.map(({value}) => value).join(' | ');

  // gesture body types
  const allBodyTypes = getResReqTypes([['body', operation.requestBody!]]);
  const allBodyTypesImports = allBodyTypes.reduce<string[]>(
    (acc, {imports = []}) => [...acc, ...imports],
    []
  );
  imports = [...imports, ...allBodyTypesImports];
  const requestBodyTypes = allBodyTypes.map(({value}) => value).join(' | ');

  const needAResponseComponent = responseTypes.includes('{');

  const paramsInPath = getParamsInPath(route);
  const {query: queryParams = [], path: pathParams = []} = groupBy(
    [...parameters, ...(operation.parameters || [])].map<ParameterObject>(p => {
      if (isReference(p)) {
        return get(
          schemasComponents,
          p.$ref.replace('#/components/', '').replace('/', '.')
        );
      } else {
        return p;
      }
    }),
    'in'
  );

  const queryParamsTypes = getQueryParamsTypes({queryParams});
  const queryParamsImports = queryParamsTypes.reduce<string[]>(
    (acc, {imports = []}) => [...acc, ...imports],
    []
  );
  const queryParamsDefinitioName = `${camel(componentName)}Params`;

  if (queryParams.length) {
    imports = [...imports, queryParamsDefinitioName];
  }

  const queryParamDefinition = {
    name: queryParamsDefinitioName,
    model: `export type ${queryParamsDefinitioName} = { ${queryParamsTypes
      .map(({definition}) => definition)
      .join(', ')} }`,
    imports: queryParamsImports
  };

  const formatedRequestBodyTypes = generalJSTypesWithArray.includes(
    requestBodyTypes
  )
    ? 'payload'
    : camel(requestBodyTypes);

  const propsDefinition = sortParams([
    ...getParamsTypes({params: paramsInPath, pathParams, operation}),
    ...(requestBodyTypes
      ? [
          {
            definition: `${formatedRequestBodyTypes}: ${requestBodyTypes}`,
            default: false,
            required: true
          }
        ]
      : []),
    ...(queryParams.length
      ? [
          {
            definition: `params?: ${queryParamsDefinitioName}`,
            default: false,
            required: false
          }
        ]
      : [])
  ])
    .map(({definition}) => definition)
    .join(', ');

  const props = sortParams([
    ...getParamsTypes({
      params: paramsInPath,
      pathParams,
      operation,
      type: 'implementation'
    }),
    ...(requestBodyTypes
      ? [
          {
            definition: `${formatedRequestBodyTypes}: ${requestBodyTypes}`,
            default: false,
            required: true
          }
        ]
      : []),
    ...(queryParams.length
      ? [
          {
            definition: `params?: ${queryParamsDefinitioName}`,
            default: false,
            required: false
          }
        ]
      : [])
  ])
    .map(({definition}) => definition)
    .join(', ');

  const definition = `
  ${operation.summary ? '// ' + operation.summary : ''}
  ${camel(componentName)}(${propsDefinition}): AxiosPromise<${
    needAResponseComponent ? componentName + 'Response' : responseTypes
  }>`;

  const axiosProps = `\`${route}\` ${
    requestBodyTypes
      ? requestBodyTypes === 'Blob'
        ? ', formData'
        : `, ${formatedRequestBodyTypes}`
      : ''
  } ${
    queryParams.length || responseTypes === 'Blob'
      ? `,
      {
        ${queryParams.length ? 'params' : ''}${
          queryParams.length && responseTypes === 'Blob' ? ',' : ''
        }${responseTypes === 'Blob' ? `responseType: 'blob',` : ''}
      }`
      : ''
  }`;

  const transformerType = `(url: string,${
    requestBodyTypes ? ` data: ${requestBodyTypes}, ` : ''
  } config?: AxiosRequestConfig) => [string, ${
    requestBodyTypes ? `${requestBodyTypes} | undefined, ` : ''
  } AxiosRequestConfig | undefined]`;

  const output = `  ${camel(componentName)}(${props}): AxiosPromise<${
    needAResponseComponent ? componentName + 'Response' : responseTypes
  }> {
    ${
      transformer
        ? `
        type Transformer = ${transformerType}

        const transformer: Transformer = ${transformer}`
        : ''
    }
    ${
      requestBodyTypes === 'Blob'
        ? `const formData = new FormData(); formData.append('file', ${camel(
            requestBodyTypes
          )});`
        : ''
    }
    return axios.${verb}(${
    transformer ? `...transformer(${axiosProps})` : axiosProps
  });
  },
`;

  return {
    value: output,
    definition,
    imports,
    ...(queryParams.length ? {queryParamDefinition} : {})
  };
};

export const generateApi = (
  specs: OpenAPIObject,
  override?: OverrideOptions
) => {
  let imports: string[] = [];
  let queryParamDefinitions: Array<{
    name: string;
    model: string;
    imports?: string[];
  }> = [];
  let definition = '';
  definition += `export interface ${pascal(specs.info.title)} {`;
  let value = '';
  value += `export const get${pascal(
    specs.info.title
  )} = (axios: AxiosInstance): ${pascal(specs.info.title)} => ({\n`;
  Object.entries(specs.paths).forEach(
    ([route, verbs]: [string, PathItemObject]) => {
      Object.entries(verbs).forEach(
        ([verb, operation]: [string, OperationObject]) => {
          if (['get', 'post', 'patch', 'put', 'delete'].includes(verb)) {
            const call = generateApiCalls(
              operation,
              verb,
              route,
              verbs.parameters,
              specs.components,
              override
            );
            if (call.queryParamDefinition) {
              queryParamDefinitions = [
                ...queryParamDefinitions,
                call.queryParamDefinition
              ];
            }
            imports = [...imports, ...call.imports];
            definition += `${call.definition};`;
            value += call.value;
          }
        }
      );
    }
  );
  definition += '\n};';
  value += '})';

  return {
    output: `${definition}\n\n${value}`,
    imports: generalTypesFilter(imports),
    queryParamDefinitions
  };
};
