import { ParameterObject, ReferenceObject, SchemaObject } from 'openapi3-ts';
import { GeneratorSchema } from '../../types/generator';
import { resolveValue } from '../resolvers/value';
import { getKey } from './keys';

const getQueryParamsTypes = (
  queryParams: (ParameterObject | ReferenceObject)[],
) => {
  return queryParams.map((p) => {
    const { name, required, schema } =
      p as
      {
        name: string;
        required: boolean;
        schema: SchemaObject;
      };

    const { value, imports } = resolveValue(schema!);

    const key = getKey(name);

    const definition = `${key}${
      !required || schema.default ? '?' : ''
    }: ${value}`;

    return {
      definition,
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

  const type = types.map(({ definition }) => definition).join('; ');

  const schema = {
    name,
    model: `export type ${name} = { ${type} };\n`,
    imports,
  };

  return schema;
};
