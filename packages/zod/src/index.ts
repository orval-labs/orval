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
  getNumberWord,
  pascal,
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

const possibleSchemaTypes = [
  'integer',
  'number',
  'string',
  'boolean',
  'object',
  'null',
  'array',
];

const resolveZodType = (schemaTypeValue: SchemaObject['type']) => {
  const type = Array.isArray(schemaTypeValue)
    ? schemaTypeValue.find((t) => possibleSchemaTypes.includes(t))
    : schemaTypeValue;

  switch (type) {
    case 'integer':
      return 'number';
    default:
      return type ?? 'any';
  }
};

let constsUniqueCounter: Record<string, number> = {};

// https://github.com/colinhacks/zod#coercion-for-primitives
const COERCEABLE_TYPES = ['string', 'number', 'boolean', 'bigint', 'date'];

const generateZodValidationSchemaDefinition = (
  schema: SchemaObject | undefined,
  _required: boolean | undefined,
  name: string,
  strict: boolean,
): { functions: [string, any][]; consts: string[] } => {
  if (!schema) return { functions: [], consts: [] };

  const consts: string[] = [];
  const constsCounter =
    typeof constsUniqueCounter[name] === 'number'
      ? constsUniqueCounter[name] + 1
      : 0;

  const constsCounterValue = constsCounter
    ? pascal(getNumberWord(constsCounter))
    : '';

  constsUniqueCounter[name] = constsCounter;

  const functions: [string, any][] = [];
  const type = resolveZodType(schema.type);
  const required = schema.default !== undefined ? false : _required ?? false;
  const nullable =
    schema.nullable ??
    (Array.isArray(schema.type) && schema.type.includes('null'));
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
        generateZodValidationSchemaDefinition(
          items,
          true,
          camel(`${name}-item`),
          strict,
        ),
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
              strict,
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
                strict,
              ),
            }))
            .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        ]);

        if (strict) {
          functions.push(['strict', undefined]);
        }

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
                strict,
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
      consts.push(`export const ${name}Min${constsCounterValue} = ${min};\n`);
      functions.push(['min', `${name}Min${constsCounterValue}`]);
    }
  }
  if (max !== undefined) {
    consts.push(`export const ${name}Max${constsCounterValue} = ${max};\n`);
    functions.push(['max', `${name}Max${constsCounterValue}`]);
  }
  if (matches) {
    const isStartWithSlash = matches.startsWith('/');
    const isEndWithSlash = matches.endsWith('/');

    const regexp = `new RegExp('${jsStringEscape(
      matches.slice(isStartWithSlash ? 1 : 0, isEndWithSlash ? -1 : undefined),
    )}')`;

    consts.push(
      `export const ${name}RegExp${constsCounterValue} = ${regexp};\n`,
    );
    functions.push(['regex', `${name}RegExp${constsCounterValue}`]);
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

export type ZodValidationSchemaDefinitionInput = {
  functions: [string, any][];
  consts: string[];
};

export const parseZodValidationSchemaDefinition = (
  input: ZodValidationSchemaDefinitionInput,
  strict: boolean,
  coerceTypes = false,
): { zod: string; consts: string } => {
  if (!input.functions.length) {
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
      return `zod.object({
${Object.entries(args)
  .map(([key, schema]) => {
    const value = (schema as ZodValidationSchemaDefinitionInput).functions
      .map(parseProperty)
      .join('');
    consts += (schema as ZodValidationSchemaDefinitionInput).consts.join('\n');
    return `  "${key}": ${value.startsWith('.') ? 'zod' : ''}${value}`;
  })
  .join(',\n')}
})${strict ? '.strict()' : ''}`;
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

    if (fn === 'strict') {
      return '.strict()';
    }

    if (coerceTypes && COERCEABLE_TYPES.includes(fn)) {
      return `.coerce.${fn}(${args})`;
    }

    return `.${fn}(${args})`;
  };

  consts += input.consts.join('\n');

  const zod = input.functions.map(parseProperty).join('');

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

const parseBodyAndResponse = ({
  data,
  context,
  name,
  strict,
}: {
  data: ResponseObject | RequestBodyObject | ReferenceObject | undefined;
  context: ContextSpecs;
  name: string;
  strict: boolean;
}): {
  input: ZodValidationSchemaDefinitionInput;
  isArray: boolean;
} => {
  if (!data) {
    return {
      input: { functions: [], consts: [] },
      isArray: false,
    };
  }

  const resolvedRef = resolveRef<ResponseObject | RequestBodyObject>(
    data,
    context,
  ).schema;

  if (!resolvedRef.content?.['application/json']?.schema) {
    return {
      input: { functions: [], consts: [] },
      isArray: false,
    };
  }

  const resolvedJsonSchema = deference(
    resolvedRef.content['application/json'].schema,
    context,
  );

  // keep the same behaviour for array
  if (resolvedJsonSchema.items) {
    return {
      input: generateZodValidationSchemaDefinition(
        resolvedJsonSchema,
        true,
        name,
        strict,
      ),
      isArray: true,
    };
  }

  return {
    input: generateZodValidationSchemaDefinition(
      resolvedJsonSchema,
      true,
      name,
      strict,
    ),
    isArray: false,
  };
};

const parseParameters = ({
  data,
  context,
  operationName,
  strict,
}: {
  data: (ParameterObject | ReferenceObject)[] | undefined;
  context: ContextSpecs;
  operationName: string;
  strict: {
    param: boolean;
    query: boolean;
    header: boolean;
    body: boolean;
    response: boolean;
  };
}): {
  headers: ZodValidationSchemaDefinitionInput;
  queryParams: ZodValidationSchemaDefinitionInput;
  params: ZodValidationSchemaDefinitionInput;
} => {
  if (!data) {
    return {
      headers: {
        functions: [],
        consts: [],
      },
      queryParams: {
        functions: [],
        consts: [],
      },
      params: {
        functions: [],
        consts: [],
      },
    };
  }

  const defintionsByParameters = data.reduce(
    (acc, val) => {
      const { schema: parameter } = resolveRef<ParameterObject>(val, context);

      if (!parameter.schema) {
        return acc;
      }

      const schema = deference(parameter.schema, context);

      const mapStrict = {
        path: strict.param,
        query: strict.query,
        header: strict.header,
      };

      const definition = generateZodValidationSchemaDefinition(
        schema,
        parameter.required,
        camel(`${operationName}-${parameter.in}-${parameter.name}`),
        mapStrict[parameter.in as 'path' | 'query' | 'header'] ?? false,
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

  const headers: ZodValidationSchemaDefinitionInput = {
    functions: [],
    consts: [],
  };

  if (Object.keys(defintionsByParameters.headers).length) {
    headers.functions.push(['object', defintionsByParameters.headers]);

    if (strict.header) {
      headers.functions.push(['strict', undefined]);
    }
  }

  const queryParams: ZodValidationSchemaDefinitionInput = {
    functions: [],
    consts: [],
  };

  if (Object.keys(defintionsByParameters.queryParams).length) {
    queryParams.functions.push(['object', defintionsByParameters.queryParams]);

    if (strict.query) {
      queryParams.functions.push(['strict', undefined]);
    }
  }

  const params: ZodValidationSchemaDefinitionInput = {
    functions: [],
    consts: [],
  };

  if (Object.keys(defintionsByParameters.params).length) {
    params.functions.push(['object', defintionsByParameters.params]);

    if (strict.param) {
      params.functions.push(['strict', undefined]);
    }
  }

  return {
    headers,
    queryParams,
    params,
  };
};

const generateZodRoute = (
  { operationName, verb, override }: GeneratorVerbOptions,
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

  const parsedResponse = parseBodyAndResponse({
    data: response,
    context,
    name: camel(`${operationName}-response`),
    strict: override.zod.strict.response,
  });

  const parsedPody = parseBodyAndResponse({
    data: requestBody,
    context,
    name: camel(`${operationName}-body`),
    strict: override.zod.strict.body,
  });

  const parsedParameters = parseParameters({
    data: parameters,
    context,
    operationName,
    strict: override.zod.strict,
  });

  const inputParams = parseZodValidationSchemaDefinition(
    parsedParameters.params,
    override.zod.strict.param,
    override.zod.coerce.param,
  );

  if (override.coerceTypes) {
    console.warn(
      'override.coerceTypes is deprecated, please use override.zod.coerce instead.',
    );
  }

  const inputQueryParams = parseZodValidationSchemaDefinition(
    parsedParameters.queryParams,
    override.zod.strict.query,
    override.zod.coerce.query ?? override.coerceTypes,
  );
  const inputHeaders = parseZodValidationSchemaDefinition(
    parsedParameters.headers,
    override.zod.strict.header,
    override.zod.coerce.header,
  );

  const inputBody = parseZodValidationSchemaDefinition(
    parsedPody.input,
    override.zod.strict.body,
    override.zod.coerce.body,
  );

  const inputResponse = parseZodValidationSchemaDefinition(
    parsedResponse.input,
    override.zod.strict.response,
    override.zod.coerce.response,
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
      ? [
          parsedPody.isArray
            ? `export const ${operationName}BodyItem = ${inputBody.zod}
export const ${operationName}Body = zod.array(${operationName}BodyItem)`
            : `export const ${operationName}Body = ${inputBody.zod}`,
        ]
      : []),
    ...(inputResponse.consts ? [inputResponse.consts] : []),
    ...(inputResponse.zod
      ? [
          parsedResponse.isArray
            ? `export const ${operationName}ResponseItem = ${inputResponse.zod}
export const ${operationName}Response = zod.array(${operationName}ResponseItem)`
            : `export const ${operationName}Response = ${inputResponse.zod}`,
        ]
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
