import { ParameterObject, PathItemObject, SchemaObject } from 'openapi3-ts';
import { VERBS_WITH_BODY } from '../../constants';
import { OutputClient, OutputClientFunc, Verbs } from '../../types';
import {
  GeneratorDependency,
  GeneratorOptions,
  GeneratorVerbOptions,
} from '../../types/generator';
import { GetterPropType } from '../../types/getters';
import { camel } from '../../utils/case';
import { toObjectString } from '../../utils/string';
import { isSyntheticDefaultImportsAllow } from '../../utils/tsconfig';
import { resolveRef } from '../resolvers/ref';
import { generateVerbImports } from './imports';
import {
  generateFormDataAndUrlEncodedFunction,
  generateMutatorConfig,
  generateMutatorRequestOptions,
  generateOptions,
} from './options';

let fileName: string | null = null;

const AXIOS_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: 'axios',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
      { name: 'AxiosRequestConfig' },
      { name: 'AxiosResponse' },
      { name: 'AxiosError' },
    ],
    dependency: 'axios',
  },
];

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

export const getZodDependencies = (hasGlobalMutator: boolean) => [
  ...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []),
  ...ZOD_DEPENDENCIES,
];

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
      validationFunctions.push([type, undefined]);
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
    validationFunctions.push(['matches', matches]);
  }
  if (schema?.enum) {
    validationFunctions.push([
      'enum',
      [`[${schema?.enum.map((value) => `'${value}'`).join(', ')}]`],
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
  { operationName, body, verb, params }: GeneratorVerbOptions,
  { pathRoute, context, override }: GeneratorOptions,
) => {
  const spec = context.specs[context.specKey].paths[pathRoute] as
    | PathItemObject
    | undefined;

  const parameters = spec?.[verb]?.parameters as ParameterObject[] | undefined;
  const requestBody = spec?.[verb]?.requestBody as any;

  const resolvedRequestBody =
    requestBody && '$ref' in requestBody
      ? resolveRef(requestBody, context).schema
      : requestBody;

  const resolvedRequestBodyJsonSchema = resolvedRequestBody?.content[
    'application/json'
  ].schema
    ? resolveRef(
        resolvedRequestBody?.content['application/json'].schema,
        context,
      ).schema
    : resolvedRequestBody?.content['application/json'].schema;

  const zodDefinitionsBodyProperties: any[] =
    (body.implementation && resolvedRequestBodyJsonSchema?.properties) ?? [];
  const zodDefinitionsBody = Object.keys(zodDefinitionsBodyProperties)
    ?.map((key) => ({
      [key]: generateZodValidationSchemaDefinition(
        zodDefinitionsBodyProperties[
          key as keyof typeof zodDefinitionsBodyProperties
        ] as any,
        resolvedRequestBodyJsonSchema?.required?.find(
          (requiredKey: string) => requiredKey === key,
        ),
      ),
    }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const zodDefinitionsHeaders = (parameters ?? [])
    ?.filter((parameter) => parameter.in === 'header')
    ?.map((parameter) => ({
      [parameter.name]: generateZodValidationSchemaDefinition(
        parameter.schema as any,
        parameter.required,
      ),
    }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const zodDefinitionsParams = (parameters ?? [])
    ?.filter((parameter) => parameter.in !== 'header')
    ?.map((parameter) => ({
      [parameter.name]: generateZodValidationSchemaDefinition(
        parameter.schema as any,
        parameter.required,
      ),
    }))
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const inputParams = parseZodValidationSchemaDefinition(zodDefinitionsParams);
  const inputHeaders = parseZodValidationSchemaDefinition(
    zodDefinitionsHeaders,
  );
  const inputBody = parseZodValidationSchemaDefinition(zodDefinitionsBody);

  return [
    inputParams
      ? `export const ${operationName}Params = ${inputParams}`
      : undefined,
    inputBody ? `export const ${operationName}Body = ${inputBody}` : undefined,
    inputHeaders
      ? `export const ${operationName}Header = ${inputHeaders}`
      : undefined,
  ]
    .filter(Boolean)
    .join('\n\n');

  // if (inputParams) {

  //   return `export const ${operationName} = zod.object({ "params": ${inputParams}}).object({"headers": ${inputHeaders}}).extend(${inputBody})`;
  // }

  // return `export const ${operationName} = zod.object({ "params": ${inputParams}}).object({"headers": ${inputHeaders}})`;
};

export const generateZodTitle = () => '';

export const generateZodHeader = () => '';

export const generateZodFooter = () => '';

export const generateZod = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  _outputClient: OutputClient | OutputClientFunc,
) => {
  const routeImplementation = generateZodRoute(verbOptions, options);

  return {
    implementation: `${routeImplementation}\n\n`,
    imports: [],
  };
};
