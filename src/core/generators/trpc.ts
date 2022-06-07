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

const TRPC_DEPENDENCIES: GeneratorDependency[] = [
  {
    exports: [
      {
        name: '* as trpc',
        alias: 'trpc',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
    ],
    dependency: '@trpc/server',
  },
  {
    exports: [
      {
        name: '* as yup',
        alias: 'yup',
        default: true,
        values: true,
        syntheticDefaultImport: true,
      },
    ],
    dependency: 'yup',
  },
];

export const getTrpcDependencies = (hasGlobalMutator: boolean) => [
  ...(!hasGlobalMutator ? AXIOS_DEPENDENCIES : []),
  ...TRPC_DEPENDENCIES,
];

const generateTrpcRequestFunction = (
  {
    queryParams,
    operationName,
    response,
    mutator,
    body,
    props,
    verb,
    formData,
    formUrlEncoded,
    override,
  }: GeneratorVerbOptions,
  { route, context }: GeneratorOptions,
) => {
  const isRequestOptions = override?.requestOptions !== false;
  const isFormData = override?.formData !== false;
  const isFormUrlEncoded = override?.formUrlEncoded !== false;
  const withRequestContext =
    override?.trpc?.passRequestContextToCustomMutator !== false;

  const isSyntheticDefaultImportsAllowed = isSyntheticDefaultImportsAllow(
    context.tsconfig,
  );
  const isBodyVerb = VERBS_WITH_BODY.includes(verb);

  const bodyForm = generateFormDataAndUrlEncodedFunction({
    formData,
    formUrlEncoded,
    body,
    isFormData,
    isFormUrlEncoded,
  });

  if (mutator) {
    const mutatorConfig = generateMutatorConfig({
      route,
      body,
      queryParams,
      response,
      verb,
      isFormData,
      isFormUrlEncoded,
      isBodyVerb,
      hasSignal: false,
    });

    const propsImplementation =
      mutator?.bodyTypeName && body.definition
        ? toObjectString(props, 'implementation').replace(
            new RegExp(`(\\w*):\\s?${body.definition}`),
            `$1: ${mutator.bodyTypeName}<${body.definition}>`,
          )
        : toObjectString(props, 'implementation');

    const requestOptions = isRequestOptions
      ? generateMutatorRequestOptions(
          override?.requestOptions,
          mutator.hasSecondArg,
        )
      : '';

    return `export const ${operationName} = (\n    ${propsImplementation}\n ${
      isRequestOptions && mutator.hasSecondArg
        ? `options?: Parameters<typeof ${mutator.name}>[1],`
        : ''
    }${!isBodyVerb ? 'signal?: AbortSignal,\n' : '\n'}${
      withRequestContext ? 'ctx?: any\n' : '\n'
    }) => {${bodyForm}
      return ${mutator.name}<${response.definition.success || 'unknown'}>(
      ${mutatorConfig},
      ${requestOptions},
      ${withRequestContext ? 'ctx' : ''}
      );
    }
  `;
  }

  const options = generateOptions({
    route,
    body,
    queryParams,
    response,
    verb,
    requestOptions: override?.requestOptions,
    isFormData,
    isFormUrlEncoded,
  });

  return `export const ${operationName} = (\n    ${toObjectString(
    props,
    'implementation',
  )} ${
    isRequestOptions ? `options?: AxiosRequestConfig\n` : ''
  } ): Promise<AxiosResponse<${
    response.definition.success || 'unknown'
  }>> => {${bodyForm}
    return axios${
      !isSyntheticDefaultImportsAllowed ? '.default' : ''
    }.${verb}(${options});
  }
`;
};

const resolveYupType = (schemaTypeValue: SchemaObject['type']) => {
  switch (schemaTypeValue) {
    case 'integer':
      return 'number';
    case 'null':
      return 'mixed';
    default:
      return schemaTypeValue ?? 'mixed';
  }
};

const generateYupValidationSchemaDefinition = (
  schema: SchemaObject | undefined,
  _required: boolean | undefined,
) => {
  if (!schema) return [];

  const validationFunctions: [string, any][] = [];
  const type = resolveYupType(schema?.type);
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
  validationFunctions.push(
    type === 'object'
      ? [
          'object',
          Object.keys(schema?.properties ?? {})
            .map((key) => ({
              [key]: generateYupValidationSchemaDefinition(
                schema?.properties?.[key],
                schema?.required?.includes(key),
              ),
            }))
            .reduce((acc, curr) => ({ ...acc, ...curr }), {}),
        ]
      : [
          schema?.enum
            ? `string<${schema?.enum.map((value) => `'${value}'`).join(' | ')}>`
            : type,
          undefined,
        ],
  );

  if (required) {
    validationFunctions.push(['required', undefined]);
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
      'oneOf',
      [`[${schema?.enum.map((value) => `'${value}'`).join(', ')}]`],
    ]);
  }

  return validationFunctions;
};

const parseYupValidationSchemaDefinition = (
  input: Record<string, [string, any][]>,
): string =>
  !Object.keys(input).length
    ? ''
    : `yup.object({
  ${Object.entries(input)
    .map(
      ([key, schema]) => `
    ${key}: ${schema[0][0] !== 'object' ? 'yup' : ''}
      ${schema
        .map(([fn, args = '']) =>
          fn === 'object'
            ? ` ${parseYupValidationSchemaDefinition(args)}`
            : `.${fn}(${args})`,
        )
        .join('')}`,
    )
    .join(',')}
})`;

const extractFileNameFromFilePath = (filePath: string) =>
  filePath.split('/').pop()?.split('.')[0] ?? '';

const generateTrpcRoute = (
  { operationName, body, props, verb, mutator }: GeneratorVerbOptions,
  { pathRoute, context, override }: GeneratorOptions,
) => {
  const withRequestContext =
    override?.trpc?.passRequestContextToCustomMutator !== false;

  fileName = extractFileNameFromFilePath(context.specKey);
  const spec = context.specs[context.specKey].paths[pathRoute] as
    | PathItemObject
    | undefined;

  const parameters = spec?.[verb]?.parameters as ParameterObject[] | undefined;
  const requestBody = spec?.[verb]?.requestBody;

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

  const yupDefinitions = (parameters ?? [])
    ?.map((parameter) => ({
      [parameter.name]: generateYupValidationSchemaDefinition(
        parameter.schema,
        parameter.required,
      ),
    }))
    .concat(
      body.implementation && resolvedRequestBodyJsonSchema
        ? {
            [body.implementation]: generateYupValidationSchemaDefinition(
              resolvedRequestBodyJsonSchema,
              resolvedRequestBody?.required,
            ),
          }
        : {},
    )
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  const properties = props
    .map(({ name, type }) =>
      type === GetterPropType.BODY ? body.implementation : name,
    )
    .join(', ');

  const inputDestructor = props
    .sort((_, { type: secondType }) =>
      secondType === GetterPropType.QUERY_PARAM ? -1 : 1,
    )
    .map(({ name, type }) => {
      switch (type) {
        case GetterPropType.BODY:
          return body.implementation;
        case GetterPropType.QUERY_PARAM:
          return `...${name}`;
        default:
          return name;
      }
    })
    .join(', ');

  const input = parseYupValidationSchemaDefinition(yupDefinitions);

  const isBodyVerb = VERBS_WITH_BODY.includes(verb);

  return `
export const ${operationName}Route = trpc.router().${
    verb === Verbs.GET ? 'query' : 'mutation'
  }('${operationName}', {
  ${input ? `input: ${input},` : ''}
  resolve: (
    {${input ? `input: {${inputDestructor}}` : ''}${
    withRequestContext ? `${input ? ', ' : ''}ctx` : ''
  }}
  ) => ${operationName}(${properties}${
    withRequestContext && mutator
      ? `${properties ? ', ' : ''}${
          !isBodyVerb ? 'undefined, ' : ''
        }undefined, ctx`
      : ''
  })
});`;
};

export const generateTrpcTitle = () => '';

export const generateTrpcHeader = () => '';

export const generateTrpcFooter = ({
  operationNames,
  title,
  customTitleFunc,
}: {
  operationNames: string[];
  title?: string;
  hasMutator: boolean;
  hasAwaitedType: boolean;
  customTitleFunc?: (title: string) => string;
}) => {
  return `
const router = trpc.router()\n${
    operationNames.length ? '.' : ''
  }${operationNames
    .map((operationName) => `merge(${operationName}Route)\n`)
    .join('.')};

${
  fileName
    ? `export const ${camel(fileName)}Router = trpc.router().merge('${camel(
        fileName,
      )}.', router);`
    : ''
}
    `;
};

export const generateTrpc = (
  verbOptions: GeneratorVerbOptions,
  options: GeneratorOptions,
  _outputClient: OutputClient | OutputClientFunc,
) => {
  const imports = generateVerbImports(verbOptions);
  const functionImplementation = generateTrpcRequestFunction(
    verbOptions,
    options,
  );
  const routeImplementation = generateTrpcRoute(verbOptions, options);

  return {
    implementation: `${functionImplementation}\n\n${routeImplementation}`,
    imports,
  };
};
