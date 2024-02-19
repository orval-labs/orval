import {
  ParameterObject,
  PathItemObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts/oas30';
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
  ContextSpecs,
  isObject,
  isBoolean,
  jsStringEscape,
} from '@orval/core';
import uniq from 'lodash.uniq';

const ZOD_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'z',
        alias: 'zod',
        values: true,
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
      return schemaTypeValue ?? 'any';
  }
};

// counter for unique naming
let counter = 0;

// https://github.com/colinhacks/zod#coercion-for-primitives
const COERCEABLE_TYPES = ['string', 'number', 'boolean', 'bigint', 'date'];

const generateZodValidationSchemaDefinition = (
  schema: SchemaObject | undefined,
  _required: boolean | undefined,
  name: string,
): { functions: [string, any][]; consts: string[] } => {
  if (!schema) return { functions: [], consts: [] };

  const consts: string[] = [];
  const functions: [string, any][] = [];
  const type = resolveZodType(schema.type);
  const required = schema.default !== undefined ? false : _required ?? false;
  const nullable = schema.nullable ?? false;
  const min =
    schema.minimum ??
    schema.exclusiveMinimum ??
    schema.minLength ??
    schema.minItems ??
    undefined;
  const max =
    schema.maximum ??
    schema.exclusiveMaximum ??
    schema.maxLength ??
    schema.maxItems ??
    undefined;
  const matches = schema.pattern ?? undefined;

  switch (type) {
    case 'array':
      const items = schema.items as SchemaObject | undefined;
      functions.push([
        'array',
        generateZodValidationSchemaDefinition(items, true, camel(name)),
      ]);
      break;
    case 'string': {
      if (schema.enum && type === 'string') {
        break;
      }

      if (schema.format === 'date') {
        functions.push(['date', undefined]);
        break;
      }

      functions.push([type as string, undefined]);

      if (schema.format === 'date-time') {
        functions.push(['datetime', undefined]);
        break;
      }

      if (schema.format === 'email') {
        functions.push(['email', undefined]);
        break;
      }

      if (schema.format === 'uri' || schema.format === 'hostname') {
        functions.push(['url', undefined]);
        break;
      }

      if (schema.format === 'uuid') {
        functions.push(['uuid', undefined]);
        break;
      }

      break;
    }
    case 'object':
    default: {
      if (schema.allOf || schema.oneOf || schema.anyOf) {
        const separator = schema.allOf
          ? 'allOf'
          : schema.oneOf
            ? 'oneOf'
            : 'anyOf';

        const schemas = (schema.allOf ?? schema.oneOf ?? schema.anyOf) as (
          | SchemaObject
          | ReferenceObject
        )[];

        functions.push([
          separator,
          schemas.map((schema) =>
            generateZodValidationSchemaDefinition(
              schema as SchemaObject,
              true,
              camel(name),
            ),
          ),
        ]);
        break;
      }

      if (schema.properties) {
        functions.push([
          'object',
          Object.keys(schema.properties)
            .map((key) => ({
              [key]: generateZodValidationSchemaDefinition(
                schema.properties?.[key] as any,
                schema.required?.includes(key),
                camel(`${name}-${key}`),
              ),
            }))
            .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        ]);

        break;
      }

      if (schema.additionalProperties) {
        functions.push([
          'additionalProperties',
          isBoolean(schema.additionalProperties)
            ? schema.additionalProperties
            : generateZodValidationSchemaDefinition(
                schema.additionalProperties as SchemaObject,
                true,
                name,
              ),
        ]);

        break;
      }

      functions.push([type as string, undefined]);
      break;
    }
  }

  if (min !== undefined) {
    if (min === 1) {
      functions.push(['min', `${min}`]);
    } else {
      counter++;
      consts.push(`export const ${name}Min${counter} = ${min};\n`);
      functions.push(['min', `${name}Min${counter}`]);
    }
  }
  if (max !== undefined) {
    counter++;
    consts.push(`export const ${name}Max${counter} = ${max};\n`);
    functions.push(['max', `${name}Max${counter}`]);
  }
  if (matches) {
    const isStartWithSlash = matches.startsWith('/');
    const isEndWithSlash = matches.endsWith('/');

    const regexp = `new RegExp('${jsStringEscape(
      matches.slice(isStartWithSlash ? 1 : 0, isEndWithSlash ? -1 : undefined),
    )}')`;

    consts.push(`export const ${name}RegExp = ${regexp};\n`);
    functions.push(['regex', `${name}RegExp`]);
  }

  if (schema.enum && type !== 'number') {
    functions.push([
      'enum',
      [
        `[${schema.enum
          .map((value) => (isString(value) ? `'${escape(value)}'` : `${value}`))
          .join(', ')}]`,
      ],
    ]);
  }

  if (!required && nullable) {
    functions.push(['nullish', undefined]);
  } else if (nullable) {
    functions.push(['nullable', undefined]);
  } else if (!required) {
    functions.push(['optional', undefined]);
  }

  return { functions, consts: uniq(consts) };
};

export type ZodValidationSchemaDefinitionInput = Record<
  string,
  { functions: [string, any][]; consts: string[] }
>;

export const parseZodValidationSchemaDefinition = (
  input: ZodValidationSchemaDefinitionInput,
  coerceTypes = false,
): { zod: string; consts: string } => {
  if (!Object.keys(input).length) {
    return { zod: '', consts: '' };
  }

  let consts = '';

  const parseProperty = (property: [string, any]): string => {
    const [fn, args = ''] = property;
    if (fn === 'allOf') {
      return args.reduce(
        (acc: string, { functions }: { functions: [string, any][] }) => {
          const value = functions.map(parseProperty).join('');
          const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;

          if (!acc) {
            acc += valueWithZod;
            return acc;
          }

          acc += `.and(${valueWithZod})`;

          return acc;
        },
        '',
      );
    }

    if (fn === 'oneOf' || fn === 'anyOf') {
      return args.reduce(
        (acc: string, { functions }: { functions: [string, any][] }) => {
          const value = functions.map(parseProperty).join('');
          const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;

          if (!acc) {
            acc += valueWithZod;
            return acc;
          }

          acc += `.or(${valueWithZod})`;

          return acc;
        },
        '',
      );
    }

    if (fn === 'additionalProperties') {
      const value = args.functions.map(parseProperty).join('');
      const valueWithZod = `${value.startsWith('.') ? 'zod' : ''}${value}`;
      consts += args.consts;
      return `zod.record(zod.string(), ${valueWithZod})`;
    }

    if (fn === 'object') {
      const parsed = parseZodValidationSchemaDefinition(args);
      consts += parsed.consts;
      return ` ${parsed.zod}`;
    }
    if (fn === 'array') {
      const value = args.functions.map(parseProperty).join('');
      if (typeof args.consts === 'string') {
        consts += args.consts;
      } else if (Array.isArray(args.consts)) {
        consts += args.consts.join('\n');
      }
      return `.array(${value.startsWith('.') ? 'zod' : ''}${value})`;
    }

    if (coerceTypes && COERCEABLE_TYPES.includes(fn)) {
      return `.coerce.${fn}(${args})`;
    }

    return `.${fn}(${args})`;
  };

  consts += Object.entries(input).reduce((acc, [key, schema]) => {
    return acc + schema.consts.join('\n');
  }, '');

  const zod = `zod.object({
${Object.entries(input)
  .map(([key, schema]) => {
    const value = schema.functions.map(parseProperty).join('');
    return `  "${key}": ${value.startsWith('.') ? 'zod' : ''}${value}`;
  })
  .join(',\n')}
})`;

  return { zod, consts };
};

const deferenceScalar = (value: any, context: ContextSpecs): unknown => {
  if (isObject(value)) {
    return deference(value, context);
  } else if (Array.isArray(value)) {
    return value.map((item) => deferenceScalar(item, context));
  } else {
    return value;
  }
};

const deference = (
  schema: SchemaObject | ReferenceObject,
  context: ContextSpecs,
): SchemaObject => {
  const refName = '$ref' in schema ? schema.$ref : undefined;
  if (refName && context.parents?.includes(refName)) {
    return {};
  }

  const childContext: ContextSpecs = {
    ...context,
    ...(refName
      ? { parents: [...(context.parents || []), refName] }
      : undefined),
  };

  const { schema: resolvedSchema } = resolveRef<SchemaObject>(
    schema,
    childContext,
  );

  return Object.entries(resolvedSchema).reduce((acc, [key, value]) => {
    acc[key] = deferenceScalar(value, childContext);
    return acc;
  }, {} as any);
};

const generateZodRoute = (
  { operationName, body, verb }: GeneratorVerbOptions,
  { pathRoute, context, override }: GeneratorOptions,
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
    ({} as { [p: string]: SchemaObject | ReferenceObject });

  const zodDefinitionsResponse = Object.entries(
    zodDefinitionsResponseProperties,
  )
    .map(([key, response]) => {
      const schema = deference(response, context);

      return {
        [key]: generateZodValidationSchemaDefinition(
          schema,
          !!resolvedResponseJsonSchema?.required?.find(
            (requiredKey: string) => requiredKey === key,
          ),
          camel(`${operationName}-response-${key}`),
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
    ({} as { [p: string]: SchemaObject | ReferenceObject });

  const zodDefinitionsBody = Object.entries(zodDefinitionsBodyProperties)
    .map(([key, body]) => {
      const schema = deference(body, context);

      return {
        [key]: generateZodValidationSchemaDefinition(
          schema,
          !!resolvedRequestBodyJsonSchema?.required?.find(
            (requiredKey: string) => requiredKey === key,
          ),
          camel(`${operationName}-body-${key}`),
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

      const schema = deference(parameter.schema, context);

      const definition = generateZodValidationSchemaDefinition(
        schema,
        parameter.required,
        camel(`${operationName}-${parameter.in}-${parameter.name}`),
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
    override.coerceTypes,
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
