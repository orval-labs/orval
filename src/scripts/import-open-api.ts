import { camel, pascal } from 'case';
import chalk from 'chalk';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import openApiValidator from 'ibm-openapi-validator';
import get from 'lodash/get';
import groupBy from 'lodash/groupBy';
import isEmpty from 'lodash/isEmpty';
import uniq from 'lodash/uniq';
import { ComponentsObject, OpenAPIObject, OperationObject, ParameterObject, PathItemObject, ReferenceObject, RequestBodyObject, ResponseObject, SchemaObject } from 'openapi3-ts';
import { join } from 'path';
import swagger2openapi from 'swagger2openapi';
import YAML from 'yamljs';

const generalJSTypes = 'number string null unknown undefined object blobpart';

/**
 * Discriminator helper for `ReferenceObject`
 *
 * @param property
 */
export const isReference = (property: any): property is ReferenceObject => {
  return Boolean(property.$ref);
};

/**
 * Return the typescript equivalent of open-api data type
 *
 * @param item
 * @ref https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.1.md#data-types
 */
export const getScalar = (item: SchemaObject) => {
  const nullable = item.nullable ? ' | null' : '';

  switch (item.type) {
    case 'int32':
    case 'int64':
    case 'number':
    case 'integer':
    case 'long':
    case 'float':
    case 'double':
      return {value: 'number' + nullable};

    case 'boolean':
      return {value: 'boolean' + nullable};

    case 'array': {
      const {value, imports} = getArray(item);
      return {value: value + nullable, imports};
    }

    case 'string':
    case 'byte':
    case 'binary':
    case 'date':
    case 'dateTime':
    case 'date-time':
    case 'password': {
      let value = 'string';
      let isEnum = false;

      if (item.enum) {
        value = `'${item.enum.join(`' | '`)}'`;
        isEnum = true;
      }

      if (item.format === 'binary') {
        value = 'BlobPart';
      }

      return {value: value + nullable, isEnum};
    }

    case 'object':
    default: {
      const {value, imports} = getObject(item);
      return {value: value + nullable, imports};
    }
  }
};

/**
 * Return the output type from the $ref
 *
 * @param $ref
 */
export const getRef = ($ref: ReferenceObject['$ref']) => {
  if ($ref.startsWith('#/components/schemas')) {
    return pascal($ref.replace('#/components/schemas/', ''));
  } else if ($ref.startsWith('#/components/responses')) {
    return pascal($ref.replace('#/components/responses/', '')) + 'Response';
  } else if ($ref.startsWith('#/components/parameters')) {
    return pascal($ref.replace('#/components/parameters/', '')) + 'Parameter';
  } else if ($ref.startsWith('#/components/requestBodies')) {
    return pascal($ref.replace('#/components/requestBodies/', '')) + 'RequestBody';
  } else {
    throw new Error('This library only resolve $ref that are include into `#/components/*` for now');
  }
};

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = (item: SchemaObject): {value: string; imports?: string[]} => {
  if (item.items) {
    if (!isReference(item.items) && (item.items.oneOf || item.items.allOf)) {
      const {value, imports} = resolveValue(item.items);
      return {value: `(${value})[]`, imports};
    } else {
      const {value, imports} = resolveValue(item.items);
      return {value: `${value}[]`, imports};
    }
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
};

/**
 * Return the output type from an object
 *
 * @param item item with type === "object"
 */
export const getObject = (item: SchemaObject): {value: string; imports?: string[]} => {
  if (isReference(item)) {
    const value = getRef(item.$ref);
    return {value, imports: [value]};
  }

  if (item.allOf) {
    let imports: string[] = [];
    return {
      value: item.allOf
        .map(val => {
          const resolvedValue = resolveValue(val);
          imports = [...imports, ...(resolvedValue.imports || [])];
          return resolvedValue.value;
        })
        .join(' & '),
      imports,
    };
  }

  if (item.oneOf) {
    let imports: string[] = [];
    return {
      value: item.oneOf
        .map(val => {
          const resolvedValue = resolveValue(val);
          imports = [...imports, ...(resolvedValue.imports || [])];
          return resolvedValue.value;
        })
        .join(' | '),
      imports,
    };
  }

  if (item.properties) {
    let imports: string[] = [];
    return {
      value:
        '{' +
        Object.entries(item.properties)
          .map(([key, prop]: [string, ReferenceObject | SchemaObject]) => {
            const isRequired = (item.required || []).includes(key);
            const resolvedValue = resolveValue(prop);
            imports = [...imports, ...(resolvedValue.imports || [])];
            return `${key}${isRequired ? '' : '?'}: ${resolvedValue.value}`;
          })
          .join('; ') +
        '}',
      imports,
    };
  }

  if (item.additionalProperties) {
    const {value, imports} = resolveValue(item.additionalProperties);
    return {value: `{[key: string]: ${value}}`, imports};
  }

  return {value: item.type === 'object' ? '{}' : 'any'};
};

/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
export const resolveValue = (schema: SchemaObject) => {
  if (isReference(schema)) {
    const value = getRef(schema.$ref);
    return {value, imports: [value]};
  }

  return getScalar(schema);
};

/**
 * Extract responses / request types from open-api specs
 *
 * @param responsesOrRequests reponses or requests object from open-api specs
 */
export const getResReqTypes = (
  responsesOrRequests: Array<[string, ResponseObject | ReferenceObject | RequestBodyObject]>,
) =>
  uniq(
    responsesOrRequests.map(([_, res]) => {
      if (!res) {
        return;
      }

      if (isReference(res)) {
        return getRef(res.$ref);
      } else {
        if (res.content && res.content['application/json']) {
          const schema = res.content['application/json'].schema!;
          return resolveValue(schema).value;
        } else if (res.content && res.content['application/octet-stream']) {
          const schema = res.content['application/octet-stream'].schema!;
          return resolveValue(schema).value;
        } else if (res.content && res.content['application/pdf']) {
          const schema = res.content['application/pdf'].schema!;
          return resolveValue(schema).value;
        }
        return 'unknown';
      }
    }),
  ).join(' | ');

const generateImports = (imports: string[] = [], path: string = '.') => {
  return imports.sort().reduce((acc, imp) => acc + `import { ${imp} } from \'${path}/${imp}\'; \n`, '');
};

/**
 * Return every params in a path
 *
 * @example
 * ```
 * getParamsInPath("/pet/{category}/{name}/");
 * // => ["category", "name"]
 * ```
 * @param path
 */
export const getParamsInPath = (path: string) => {
  let n;
  const output = [];
  const templatePathRegex = /\{(\w+)}/g;
  // tslint:disable-next-line:no-conditional-assignment
  while ((n = templatePathRegex.exec(path)) !== null) {
    output.push(n[1]);
  }

  return output;
};

/**
 * Import and parse the openapi spec from a yaml/json
 *
 * @param data raw data of the spec
 * @param format format of the spec
 */
const importSpecs = (data: string, extension: 'yaml' | 'json'): Promise<OpenAPIObject> => {
  const schema = extension === 'yaml' ? YAML.parse(data) : JSON.parse(data);

  return new Promise((resolve, reject) => {
    if (!schema.openapi || !schema.openapi.startsWith('3.0')) {
      swagger2openapi.convertObj(schema, {}, (err, {openapi}) => {
        if (err) {
          reject(err);
        } else {
          resolve(openapi);
        }
      });
    } else {
      resolve(schema);
    }
  });
};

/**
 * Generate a restful-client component from openapi operation specs
 *
 * @param operation
 * @param verb
 * @param route
 * @param baseUrl
 * @param operationIds - List of `operationId` to check duplication
 */
export const getApiCall = (
  operation: OperationObject,
  verb: string,
  route: string,
  operationIds: string[],
  parameters: Array<ReferenceObject | ParameterObject> = [],
  schemasComponents?: ComponentsObject,
  /*  customProps: AdvancedOptions['customProps'] = {}, */
) => {
  if (!operation.operationId) {
    throw new Error(`Every path must have a operationId - No operationId set for ${verb} ${route}`);
  }
  if (operationIds.includes(operation.operationId)) {
    throw new Error(`"${operation.operationId}" is duplicated in your schema definition!`);
  }
  let output = '';
  operationIds.push(operation.operationId);

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
  //const isError = ([statusCode]: [string, ResponseObject | ReferenceObject]) =>
  //  statusCode.toString().startsWith('4') || statusCode.toString().startsWith('5') || statusCode === 'default';

  const responseTypes = getResReqTypes(Object.entries(operation.responses).filter(isOk));

  //const errorTypes = getResReqTypes(Object.entries(operation.responses).filter(isError)) || 'unknown';
  const requestBodyTypes = getResReqTypes([['body', operation.requestBody!]]);
  const needAResponseComponent = responseTypes.includes('{');

  const paramsInPath = getParamsInPath(route).filter(param => !(verb === 'delete' && param === lastParamInTheRoute));
  const {query: queryParams = [], path: pathParams = [] /* , header: headerParams = [] */} = groupBy(
    [...parameters, ...(operation.parameters || [])].map<ParameterObject>(p => {
      if (isReference(p)) {
        return get(schemasComponents, p.$ref.replace('#/components/', '').replace('/', '.'));
      } else {
        return p;
      }
    }),
    'in',
  );

  const paramsTypes = paramsInPath
    .map(p => {
      try {
        const {name, required, schema} = pathParams.find(i => i.name === p)!;
        return `${name}${required ? '' : '?'}: ${resolveValue(schema!).value}`;
      } catch (err) {
        throw new Error(`The path params ${p} can't be found in parameters (${operation.operationId})`);
      }
    })
    .join(', ');

  const queryParamsType = queryParams
    .map(p => `${p.name}${p.required ? '' : '?'}: ${resolveValue(p.schema!).value}`)
    .join(', ');

  let definition = `
  ${operation.summary ? '// ' + operation.summary : ''}\n`;

  const callDefinition = `  ${camel(componentName)}(${paramsTypes ? `${paramsTypes}` : ''}${
    paramsTypes && requestBodyTypes ? ', ' : ''
  }${requestBodyTypes ? `${camel(requestBodyTypes)}: ${requestBodyTypes}` : ''}${
    (paramsTypes || requestBodyTypes) && queryParamsType ? ', ' : ''
  }${queryParamsType ? `params: { ${queryParamsType} }` : ''}): AxiosResponse<${
    needAResponseComponent ? componentName + 'Response' : responseTypes
  }>`;

  output = `${callDefinition} {
    return axios.${verb}(\`${route}\` ${requestBodyTypes ? `, ${camel(requestBodyTypes)}` : ''} ${
    queryParamsType || responseTypes === 'BlobPart'
      ? `,
      {
        ${queryParamsType ? 'params' : ''}${queryParamsType && responseTypes === 'BlobPart' ? ',' : ''}${
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

  definition += callDefinition;

  return {value: output, definition, imports: [responseTypes, requestBodyTypes]};
};

export const getApi = (specs: OpenAPIObject, operationIds: string[], directory?: string) => {
  let imports: string[] = [];
  let definition = '';
  definition += `export interface ${pascal(specs.info.title)} {`;
  let value = '';
  value += `export const get${pascal(specs.info.title)} = (axios: AxiosInstance): ${pascal(specs.info.title)} => ({\n`;
  Object.entries(specs.paths).forEach(([route, verbs]: [string, PathItemObject]) => {
    Object.entries(verbs).forEach(([verb, operation]: [string, OperationObject]) => {
      if (['get', 'post', 'patch', 'put', 'delete'].includes(verb)) {
        const call = getApiCall(
          operation,
          verb,
          route,
          operationIds,
          verbs.parameters,
          specs.components,
          /*  customProps, */
        );
        imports = [...imports, ...call.imports];
        definition += `${call.definition};`;
        value += call.value;
      }
    });
  });
  definition += '\n};';
  value += '})';

  return `${
    directory
      ? `${generateImports(
          uniq(imports.filter(imp => imp && !generalJSTypes.includes(imp.toLocaleLowerCase()))),
          '../model',
        )}\n`
      : ''
  }${definition}\n\n${value}`;
};

/**
 * Generate the interface string
 * A tslint comment is insert if the resulted object is empty
 *
 * @param name interface name
 * @param schema
 */
export const generateInterface = (name: string, schema: SchemaObject, directory?: string) => {
  const {value, imports} = getScalar(schema);
  const isEmptyObject = value === '{}';
  let output = '';

  if (directory) {
    output += generateImports(imports);
    output += '\n';
  }
  output += isEmptyObject
    ? `// tslint:disable-next-line:no-empty-interface
export interface ${pascal(name)} ${value}`
    : `export interface ${pascal(name)} ${value}`;

  return output;
};

/**
 * Propagate every `discriminator.propertyName` mapping to the original ref
 *
 * Note: This method directly mutate the `specs` object.
 *
 * @param specs
 */
export const resolveDiscriminator = (specs: OpenAPIObject) => {
  if (specs.components && specs.components.schemas) {
    Object.values(specs.components.schemas).forEach(schema => {
      if (!schema.discriminator || !schema.discriminator.mapping) {
        return;
      }
      const {mapping, propertyName} = schema.discriminator;

      Object.entries(mapping).map(([name, ref]) => {
        if (!ref.startsWith('#/components/schemas/')) {
          throw new Error('Discriminator mapping outside of `#/components/schemas` is not supported');
        }
        if (
          specs.components &&
          specs.components.schemas &&
          specs.components.schemas[ref.slice('#/components/schemas/'.length)] &&
          specs.components.schemas[ref.slice('#/components/schemas/'.length)].properties &&
          specs.components.schemas[ref.slice('#/components/schemas/'.length)].properties![propertyName] &&
          !specs.components.schemas[ref.slice('#/components/schemas/'.length)].properties![propertyName].$ref
        ) {
          // @ts-ignore This is check on runtime
          specs.components.schemas[ref.slice('#/components/schemas/'.length)].properties![propertyName].enum = [name];
        }
      });
    });
  }
};

/**
 * Extract all types from #/components/schemas
 *
 * @param schemas
 */
export const generateSchemasDefinition = (schemas: ComponentsObject['schemas'] = {}, directory?: string) => {
  if (isEmpty(schemas)) {
    return '';
  }

  const models = Object.entries(schemas).map(([name, schema]) => {
    let output = '';
    if (
      (!schema.type || schema.type === 'object') &&
      !schema.allOf &&
      !schema.oneOf &&
      !isReference(schema) &&
      !schema.nullable
    ) {
      output = generateInterface(name, schema, directory);
    } else {
      const {value, imports, isEnum} = resolveValue(schema);

      if (directory) {
        output += generateImports(imports);
        output += '\n';
      }
      output += `export type ${pascal(name)} = ${value};`;

      if (isEnum) {
        output += `\n\nexport const ${pascal(name)} = {\n${value
          .split(' | ')
          .reduce((acc, val) => acc + `  ${val.replace(/\W|_/g, '')}: ${val} as ${pascal(name)},\n`, '')}};`;
      }
    }

    if (directory) {
      writeFileSync(join(process.cwd(), `${directory}/${pascal(name)}.ts`), output);
      appendFileSync(join(process.cwd(), `${directory}/index.ts`), `export * from './${pascal(name)}'\n`);
    }

    return output;
  });

  if (directory) {
    return '';
  }

  return models.join('\n\n') + '\n';
};

/**
 * Extract all types from #/components/responses
 *
 * @param responses
 */
export const generateResponsesDefinition = (responses: ComponentsObject['responses'] = {}, directory?: string) => {
  if (isEmpty(responses)) {
    return '';
  }

  const models = Object.entries(responses).map(([name, response]) => {
    const type = getResReqTypes([['', response]]);
    const isEmptyInterface = type === '{}';

    let model = '';
    if (isEmptyInterface) {
      model = `// tslint:disable-next-line:no-empty-interface \nexport interface ${pascal(name)}Response ${type}`;
    } else if (type.includes('{') && !type.includes('|') && !type.includes('&')) {
      model = `export interface ${pascal(name)}Response ${type}`;
    } else {
      model = `${directory && type ? `import { ${type} } from \"./${type}\";\n\n` : ''}export type ${pascal(
        name,
      )}Response = ${type || 'unknown'};`;
    }

    if (directory) {
      writeFileSync(join(process.cwd(), `${directory}/${pascal(name)}Response.ts`), model);
      appendFileSync(join(process.cwd(), `${directory}/index.ts`), `export * from './${pascal(name)}Response'\n`);
    }

    return model;
  });

  const output = '\n' + models.join('\n\n') + '\n';

  if (directory) {
    return '';
  }

  return output;
};

/**
 * Validate the spec with ibm-openapi-validator (with a custom pretty logger).
 *
 * @param specs openAPI spec
 */
const validate = async (specs: OpenAPIObject) => {
  // tslint:disable:no-console
  const log = console.log;

  // Catch the internal console.log to add some information if needed
  // because openApiValidator() calls console.log internally and
  // we want to add more context if it's used
  let wasConsoleLogCalledFromBlackBox = false;
  console.log = (...props: any) => {
    wasConsoleLogCalledFromBlackBox = true;
    log(...props);
  };
  const {errors, warnings} = await openApiValidator(specs);
  console.log = log; // reset console.log because we're done with the black box

  if (wasConsoleLogCalledFromBlackBox) {
    log('More information: https://github.com/IBM/openapi-validator/#configuration');
  }
  if (warnings.length) {
    log(chalk.yellow('(!) Warnings'));
    warnings.forEach(i =>
      log(
        chalk.yellow(`
Message : ${i.message}
Path    : ${i.path}`),
      ),
    );
  }
  if (errors.length) {
    log(chalk.red('(!) Errors'));
    errors.forEach(i =>
      log(
        chalk.red(`
Message : ${i.message}
Path    : ${i.path}`),
      ),
    );
  }
  // tslint:enable:no-console
};

/**
 * Main entry of the generator. Generate restful-client from openAPI.
 *
 * @param options.data raw data of the spec
 * @param options.format format of the spec
 * @param options.transformer custom function to transform your spec
 * @param options.validation validate the spec with ibm-openapi-validator tool
 */
const importOpenApi = async ({
  data,
  format,
  transformer,
  validation,
  directory,
}:
{
  data: string;
  format: 'yaml' | 'json';
  transformer?: (specs: OpenAPIObject) => OpenAPIObject;
  validation?: boolean;
  directory?: string;
}) => {
  const operationIds: string[] = [];
  let specs = await importSpecs(data, format);
  if (transformer) {
    specs = transformer(specs);
  }

  if (validation) {
    await validate(specs);
  }

  if(directory){
    const isExist = existsSync(join(process.cwd(), directory))
    if(!isExist){
      mkdirSync(join(process.cwd(), directory))
    }
    writeFileSync(join(process.cwd(), `${directory}/index.ts`), '');
  }

  resolveDiscriminator(specs);

  let output = '';


  output += generateSchemasDefinition(specs.components && specs.components.schemas, directory);
  output += generateResponsesDefinition(specs.components && specs.components.responses, directory);
  if (!directory) {
    output += '\n';
  }
  output += getApi(specs, operationIds, directory);

  output =
    `/* Generated */

import { AxiosResponse, AxiosInstance } from 'axios'
` + output;
  return output;
};

export default importOpenApi;
