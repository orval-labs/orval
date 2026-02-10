import { resolveValue } from '../resolvers';
import type {
  ContextSpec,
  GeneratorImport,
  GeneratorSchema,
  GetterParameters,
  GetterQueryParam,
  OpenApiParameterObject,
  OpenApiSchemaObject,
} from '../types';
import { jsDoc, pascal, sanitize } from '../utils';
import { getEnum, getEnumDescriptions, getEnumNames } from './enum';
import { getKey } from './keys';

type QueryParamsType = {
  definition: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema: OpenApiSchemaObject;
};

function getQueryParamsTypes(
  queryParams: GetterParameters['query'],
  operationName: string,
  context: ContextSpec,
): QueryParamsType[] {
  return queryParams.map(({ parameter, imports: parameterImports }) => {
    const {
      name,
      required,
      schema: schemaParam,
      content,
    } = parameter as {
      name: string;
      required: boolean;
      schema: OpenApiSchemaObject;
      content: OpenApiParameterObject['content'];
    };

    const queryName = sanitize(`${pascal(operationName)}${pascal(name)}`, {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    });

    const schema = schemaParam ?? content['application/json']?.schema;
    if (!schema) {
      throw new Error(
        `Query parameter "${name}" has no schema or content definition`,
      );
    }

    const resolvedValue = resolveValue({
      schema,
      context,
      name: queryName,
    });

    const key = getKey(name);
    const doc = jsDoc(
      {
        description: parameter.description,
        ...schema,
      },
      void 0,
      context,
    );

    if (parameterImports.length > 0) {
      return {
        definition: `${doc}${key}${!required || schema.default ? '?' : ''}: ${
          parameterImports[0].name
        };`,
        imports: parameterImports,
        schemas: [],
        originalSchema: resolvedValue.originalSchema,
      };
    }

    if (resolvedValue.isEnum && !resolvedValue.isRef) {
      const enumName = queryName;
      const enumValue = getEnum(
        resolvedValue.value,
        enumName,
        getEnumNames(resolvedValue.originalSchema),
        context.output.override.enumGenerationType,
        getEnumDescriptions(resolvedValue.originalSchema),
        context.output.override.namingConvention.enum,
      );

      return {
        definition: `${doc}${key}${
          !required || schema.default ? '?' : ''
        }: ${enumName};`,
        imports: [{ name: enumName }],
        schemas: [
          ...resolvedValue.schemas,
          { name: enumName, model: enumValue, imports: resolvedValue.imports },
        ],
        originalSchema: resolvedValue.originalSchema,
      };
    }

    const definition = `${doc}${key}${
      !required || schema.default ? '?' : ''
    }: ${resolvedValue.value};`;

    return {
      definition,
      imports: resolvedValue.imports,
      schemas: resolvedValue.schemas,
      originalSchema: resolvedValue.originalSchema,
    };
  });
}

interface GetQueryParamsOptions {
  queryParams: GetterParameters['query'];
  operationName: string;
  context: ContextSpec;
  suffix?: string;
}

export function getQueryParams({
  queryParams,
  operationName,
  context,
  suffix = 'params',
}: GetQueryParamsOptions): GetterQueryParam | undefined {
  if (queryParams.length === 0) {
    return;
  }
  const types = getQueryParamsTypes(queryParams, operationName, context);
  const imports = types.flatMap(({ imports }) => imports);
  const schemas = types.flatMap(({ schemas }) => schemas);
  const name = `${pascal(operationName)}${pascal(suffix)}`;

  const type = types.map(({ definition }) => definition).join('\n');
  const allOptional = queryParams.every(({ parameter }) => !parameter.required);

  const schema = {
    name,
    model: `export type ${name} = {\n${type}\n};\n`,
    imports,
  };

  return {
    schema,
    deps: schemas,
    isOptional: allOptional,
  };
}
