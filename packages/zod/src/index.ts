import {
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts';
import {
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
) => {
  if (!schema) return [];

  const validationFunctions: [string, any][] = [];
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
      validationFunctions.push([
        'object',
        Object.keys(schema?.properties ?? {})
          .map((key) => ({
            [key]: generateZodValidationSchemaDefinition(
              schema?.properties?.[key] as any,
              schema?.required?.includes(key),
            ),
          }))
          .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
      ]);
      break;
    case 'array':
      const items = schema?.items as SchemaObject | undefined;
      validationFunctions.push([
        'array',
        generateZodValidationSchemaDefinition(items, true),
      ]);
      break;
    default:
      if (schema?.enum && type === 'string') {
        break;
      }
      validationFunctions.push([type as string, undefined]);
      break;
  }

  if (!required) {
    validationFunctions.push(['optional', undefined]);
  }
  if (min !== undefined) {
    validationFunctions.push(['min', min]);
  }
  if (max !== undefined) {
    validationFunctions.push(['max', max]);
  }
  if (matches) {
    const isStartWithSlash = matches.startsWith('/');
    const isEndWithSlash = matches.endsWith('/');
    validationFunctions.push([
      'matches',
      `new RegExp('${matches.slice(
        isStartWithSlash ? 1 : 0,
        isEndWithSlash ? -1 : undefined,
      )}')`,
    ]);
  }
  if (schema?.enum) {
    validationFunctions.push([
      'enum',
      [
        `[${schema?.enum
          .map((value) => (isString(value) ? `'${escape(value)}'` : `${value}`))
          .join(', ')}]`,
      ],
    ]);
  }

  return validationFunctions;
};

const parseZodValidationSchemaDefinition = (
  input: Record<string, [string, any][]>,
): string => {
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

  return !Object.keys(input).length
    ? ''
    : `zod.object({
  ${Object.entries(input)
    .map(
      ([key, schema]) =>
        `"${key}": ${schema[0][0] !== 'object' ? 'zod' : ''}${schema
          .map(parseProperty)
          .join('')}`,
    )
    .join(',')}
})`;
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
      Record<string, [string, any][]>
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

  if (!inputParams && !inputHeaders && !inputBody) return '';

  return [
    inputParams
      ? `export const ${operationName}Params = ${inputParams}`
      : undefined,
    inputQueryParams
      ? `export const ${operationName}QueryParams = ${inputQueryParams}`
      : undefined,
    inputHeaders
      ? `export const ${operationName}Header = ${inputHeaders}`
      : undefined,
    inputBody ? `export const ${operationName}Body = ${inputBody}` : undefined,
    inputResponse
      ? `export const ${operationName}Response = ${inputResponse}`
      : undefined,
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
