import { ContentObject, SchemaObject } from 'openapi3-ts';
import { resolveValue } from '../resolvers';
import {
  ContextSpecs,
  GeneratorImport,
  GeneratorSchema,
  GetterParameters,
  GetterQueryParam,
} from '../types';
import { pascal, sanitize } from '../utils';
import { getEnum } from './enum';
import { getKey } from './keys';

type QueryParamsType = {
  definition: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
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

    const resolvedeValue = resolveValue({
      schema,
      context,
      name: queryName,
    });

    const key = getKey(name);

    if (parameterImports.length) {
      return {
        definition: `${key}${!required || schema.default ? '?' : ''}: ${
          parameterImports[0].name
        }`,
        imports: parameterImports,
        schemas: [],
      };
    }

    if (resolvedeValue.isEnum && !resolvedeValue.isRef) {
      const enumName = queryName;

      const enumValue = getEnum(
        resolvedeValue.value,
        enumName,
        resolvedeValue.originalSchema?.['x-enumNames'],
      );

      return {
        definition: `${key}${
          !required || schema.default ? '?' : ''
        }: ${enumName}`,
        imports: [{ name: enumName }],
        schemas: [
          ...resolvedeValue.schemas,
          { name: enumName, model: enumValue, imports: resolvedeValue.imports },
        ],
      };
    }

    const definition = `${key}${!required || schema.default ? '?' : ''}: ${
      resolvedeValue.value
    }`;

    return {
      definition,
      imports: resolvedeValue.imports,
      schemas: resolvedeValue.schemas,
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

  const type = types.map(({ definition }) => definition).join('; ');
  const allOptional = queryParams.every(({ parameter }) => !parameter.required);

  const schema = {
    name,
    model: `export type ${name} = { ${type} };\n`,
    imports,
  };

  return {
    schema,
    deps: schemas,
    isOptional: allOptional,
  };
};
