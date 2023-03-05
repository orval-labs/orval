import {
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts';
import {
  camel,
  ClientBuilder,
  ClientGeneratorsBuilder,
  escape,
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
  isString,
  resolveRef,
} from '@orval/core';

const ZOD_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: '* as zod',
        alias: 'zod',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
    ],
    dependency: 'zod',
  },
];

export const getZodDependencies = () => ZOD_DEPENDENCIES;

const resolveZodType = (schemaTypeValue: SchemaObject['type']) => {
  switch (schemaTypeValue) {
    case 'integer':
      return 'number';
    case 'null':
      return 'mixed';
    default:
      return schemaTypeValue ?? 'mixed';
  }
};

const generateZodValidationSchemaDefinition = (
  schema: SchemaObject | undefined,
  _required: boolean | undefined,
  name: string,
): { functions: [string, any][]; consts: string[] } => {
  if (!schema) return { functions: [], consts: [] };

  const consts = [];
  const functions: [string, any][] = [];
  const type = resolveZodType(schema?.type);
  const required =
    schema?.default !== undefined
      ? false
      : _required ?? !schema?.nullable ?? false;
  const min =
    schema?.minimum ??
    schema?.exclusiveMinimum ??
    schema?.minLength ??
    undefined;
  const max =
    schema?.maximum ??
    schema?.exclusiveMaximum ??
    schema?.maxLength ??
    undefined;
  const matches = schema?.pattern ?? undefined;

  switch (type) {
    case 'object':
      functions.push([
        'object',
        Object.keys(schema?.properties ?? {})
          .map((key) => ({
            [key]: generateZodValidationSchemaDefinition(
              schema?.properties?.[key] as any,
              schema?.required?.includes(key),
              camel(`${name}-${key}`),
            ),
          }))
          .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      ]);
      break;
    case 'array':
      const items = schema?.items as SchemaObject | undefined;
      functions.push([
        'array',
        generateZodValidationSchemaDefinition(items, true, camel(name)),
      ]);
      break;
    default:
      if (schema?.enum && type === 'string') {
        break;
      }
      functions.push([type as string, undefined]);
      break;
  }

  if (!required) {
    functions.push(['optional', undefined]);
  }
  if (min !== undefined) {
    consts.push(`export const ${name}Min = ${min};`);
    functions.push(['min', `${name}Min`]);
  }
  if (max !== undefined) {
    consts.push(`export const ${name}Max = ${min};`);
    functions.push(['max', `${name}Max`]);
  }
  if (matches) {
    const isStartWithSlash = matches.startsWith('/');
    const isEndWithSlash = matches.endsWith('/');

    const regexp = `new RegExp('${matches.slice(
      isStartWithSlash ? 1 : 0,
      isEndWithSlash ? -1 : undefined,
    )}')`;

    consts.push(`export const ${name}Matches = ${regexp};`);
    functions.push(['matches', `${name}Matches`]);
  }
  if (schema?.enum) {
    functions.push([
      'enum',
      [
        `[${schema?.enum
          .map((value) => (isString(value) ? `'${escape(value)}'` : `${value}`))
          .join(', ')}]`,
      ],
    ]);
  }

  return { functions, consts };
};

const parseZodValidationSchemaDefinition = (
  input: Record<string, { functions: [string, any][]; consts: string[] }>,
): { zod: string; consts: string } => {
  const parseProperty = ([fn, args = '']: [string, any]): string => {
    if (fn === 'object') return ` ${parseZodValidationSchemaDefinition(args)}`;
    if (fn === 'array')
      return `.array(${
        Array.isArray(args)
          ? `zod${args.map(parseProperty).join('')}`
          : parseProperty(args)
      })`;

    return `.${fn}(${args})`;
  };

  if (!Object.keys(input).length) {
    return { zod: '', consts: '' };
  }

  const consts = Object.entries(input).reduce((acc, [key, schema]) => {
    return acc + schema.consts.join('\n');
  }, '');

  const zod = `zod.object({
  ${Object.entries(input)
    .map(
      ([key, schema]) =>
        `"${key}": ${
          schema.functions[0][0] !== 'object' ? 'zod' : ''
        }${schema.functions.map(parseProperty).join('')}`,
    )
    .join(',')}
})`;

  return { zod, consts };
};

const generateZodRoute = (
  { operationName, body, verb }: GeneratorVerbOptions,
  { pathRoute, context }: GeneratorOptions,
) => {
  const spec = context.specs[context.specKey].paths[pathRoute] as
    | PathItemObject
    | undefined;

  const parameters = spec?.[verb]?.parameters;
  const requestBody = spec?.[verb]?.requestBody;
  const response = spec?.[verb]?.responses?.['200'] as
    | ResponseObject
    | ReferenceObject;

  const resolvedResponse = response
    ? resolveRef<ResponseObject>(response, context).schema
    : undefined;

  const resolvedResponseJsonSchema = resolvedResponse?.content?.[
    'application/json'
  ]?.schema
    ? resolveRef<SchemaObject>(
        resolvedResponse.content['application/json'].schema,
        context,
      ).schema
    : undefined;

  const zodDefinitionsResponseProperties =
    resolvedResponseJsonSchema?.properties ??
    ([] as (SchemaObject | ReferenceObject)[]);

  const zodDefinitionsResponse = Object.entries(
    zodDefinitionsResponseProperties,
  )
    .map(([key, response]) => {
      const { schema } = resolveRef<SchemaObject>(response, context);

      return {
        [key]: generateZodValidationSchemaDefinition(
          schema,
          !!resolvedResponseJsonSchema?.required?.find(
            (requiredKey: string) => requiredKey === key,
          ),
          camel(`${operationName}-${key}`),
        ),
      };
    })
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const resolvedRequestBody = requestBody
    ? resolveRef<RequestBodyObject>(requestBody, context).schema
    : undefined;

  const resolvedRequestBodyJsonSchema = resolvedRequestBody?.content?.[
    'application/json'
  ]?.schema
    ? resolveRef<SchemaObject>(
        resolvedRequestBody.content['application/json'].schema,
        context,
      ).schema
    : undefined;

  const zodDefinitionsBodyProperties =
    resolvedRequestBodyJsonSchema?.properties ??
    ([] as (SchemaObject | ReferenceObject)[]);

  const zodDefinitionsBody = Object.entries(zodDefinitionsBodyProperties)
    .map(([key, body]) => {
      const { schema } = resolveRef<SchemaObject>(body, context);

      return {
        [key]: generateZodValidationSchemaDefinition(
          schema,
          !!resolvedRequestBodyJsonSchema?.required?.find(
            (requiredKey: string) => requiredKey === key,
          ),
          camel(`${operationName}-${key}`),
        ),
      };
    })
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const zodDefinitionsParameters = (parameters ?? []).reduce(
    (acc, val) => {
      const { schema: parameter } = resolveRef<ParameterObject>(val, context);

      if (!parameter.schema) {
        return acc;
      }

      const { schema } = resolveRef<SchemaObject>(parameter.schema, context);

      const definition = generateZodValidationSchemaDefinition(
        schema,
        parameter.required,
        camel(`${operationName}-${parameter.name}`),
      );

      if (parameter.in === 'header') {
        return {
          ...acc,
          headers: { ...acc.headers, [parameter.name]: definition },
        };
      }

      if (parameter.in === 'query') {
        return {
          ...acc,
          queryParams: { ...acc.queryParams, [parameter.name]: definition },
        };
      }

      if (parameter.in === 'path') {
        return {
          ...acc,
          params: { ...acc.params, [parameter.name]: definition },
        };
      }

      return acc;
    },
    {
      headers: {},
      queryParams: {},
      params: {},
    } as Record<
      'headers' | 'queryParams' | 'params',
      Record<string, { functions: [string, any][]; consts: string[] }>
    >,
  );

  const inputParams = parseZodValidationSchemaDefinition(
    zodDefinitionsParameters.params,
  );
  const inputQueryParams = parseZodValidationSchemaDefinition(
    zodDefinitionsParameters.queryParams,
  );
  const inputHeaders = parseZodValidationSchemaDefinition(
    zodDefinitionsParameters.headers,
  );
  const inputBody = parseZodValidationSchemaDefinition(zodDefinitionsBody);
  const inputResponse = parseZodValidationSchemaDefinition(
    zodDefinitionsResponse,
  );

  if (
    !inputParams.zod &&
    !inputQueryParams.zod &&
    !inputHeaders.zod &&
    !inputBody.zod &&
    !inputResponse.zod
  ) {
    return '';
  }

  return [
    ...(inputParams.consts ? [inputParams.consts] : []),
    ...(inputParams.zod
      ? [`export const ${operationName}Params = ${inputParams.zod}`]
      : []),
    ...(inputQueryParams.consts ? [inputQueryParams.consts] : []),
    ...(inputQueryParams.zod
      ? [`export const ${operationName}QueryParams = ${inputQueryParams.zod}`]
      : []),
    ...(inputHeaders.consts ? [inputHeaders.consts] : []),
    ...(inputHeaders.zod
      ? [`export const ${operationName}Header = ${inputHeaders.zod}`]
      : []),
    ...(inputBody.consts ? [inputBody.consts] : []),
    ...(inputBody.zod
      ? [`export const ${operationName}Body = ${inputBody.zod}`]
      : []),
    ...(inputResponse.consts ? [inputResponse.consts] : []),
    ...(inputResponse.zod
      ? [`export const ${operationName}Response = ${inputResponse.zod}`]
      : []),
  ].join('\n\n');
};

export const generateZod: ClientBuilder = (verbOptions, options) => {
  const routeImplementation = generateZodRoute(verbOptions, options);

  return {
    implementation: routeImplementation ? `${routeImplementation}\n\n` : '',
    imports: [],
  };
};

const zodClientBuilder: ClientGeneratorsBuilder = {
  client: generateZod,
  dependencies: getZodDependencies,
};

export const builder = () => () => zodClientBuilder;

export default builder;
