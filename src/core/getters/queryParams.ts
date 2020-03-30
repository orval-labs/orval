import { ParameterObject, ReferenceObject, SchemaObject } from 'openapi3-ts';
import { GeneratorSchema } from '../../types/generator';
import { resolveValue } from '../resolvers/value';

const getQueryParamsTypes = (
  queryParams: (ParameterObject | ReferenceObject)[],
) => {
  return queryParams.map((p) => {
    const { name, required, schema } = p as {
      name: string;
      required: boolean;
      schema: SchemaObject;
    };

    const { value, imports } = resolveValue(schema!);

    const definition = `${name}${
      !required || schema.default ? '?' : ''
    }: ${value}`;

    const implementation = `${name}${
      !required && !schema.default ? '?' : ''
    }: ${value}${schema.default ? ` = ${schema.default}` : ''}`;

    return {
      name,
      definition,
      implementation,
      default: schema.default,
      required,
      imports,
    };
  });
};

export const getQueryParams = (
  queryParams: (ParameterObject | ReferenceObject)[] = [],
  definitionName: string,
): GeneratorSchema | undefined => {
  if (!queryParams.length) {
    return;
  }
  const types = getQueryParamsTypes(queryParams);
  const imports = types.reduce<string[]>(
    (acc, { imports = [] }) => [...acc, ...imports],
    [],
  );
  const name = `${definitionName}Params`;

  const schema = {
    name,
    model: `export type ${name} = { ${types
      .map(({ definition }) => definition)
      .join('; ')} }`,
    imports,
  };

  return schema;
};
