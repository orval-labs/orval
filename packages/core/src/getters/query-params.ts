import { ContentObject, SchemaObject } from 'openapi3-ts/oas30';
import { resolveValue } from '../resolvers';
import {
  ContextSpecs,
  GeneratorImport,
  GeneratorSchema,
  GetterParameters,
  GetterQueryParam,
} from '../types';
import { jsDoc, pascal, sanitize } from '../utils';
import { getEnum } from './enum';
import { getKey } from './keys';

type QueryParamsType = {
  definition: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
  originalSchema: SchemaObject;
};

const getQueryParamsTypes = (
  queryParams: GetterParameters['query'],
  operationName: string,
  context: ContextSpecs,
): QueryParamsType[] => {
  return queryParams.map(({ parameter, imports: parameterImports }) => {
    const {
      name,
      required,
      schema: schemaParam,
      content,
    } = parameter as {
      name: string;
      required: boolean;
      schema: SchemaObject;
      content: ContentObject;
    };

    const queryName = sanitize(`${pascal(operationName)}${pascal(name)}`, {
      underscore: '_',
      whitespace: '_',
      dash: true,
      es5keyword: true,
      es5IdentifierName: true,
    });

    const schema = (schemaParam || content['application/json'].schema)!;

    const resolvedValue = resolveValue({
      schema,
      context,
      name: queryName,
    });

    const key = getKey(name);
    const doc = jsDoc(parameter);

    if (parameterImports.length) {
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
        resolvedValue.originalSchema?.['x-enumNames'],
        context.output.override.useNativeEnums,
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
};

export const getQueryParams = ({
  queryParams = [],
  operationName,
  context,
  suffix = 'params',
}: {
  queryParams: GetterParameters['query'];
  operationName: string;
  context: ContextSpecs;
  suffix?: string;
}): GetterQueryParam | undefined => {
  if (!queryParams.length) {
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
};
