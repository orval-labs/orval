import { ParameterObject, SchemaObject } from 'openapi3-ts';
import { InputTarget } from '../../types';
import { GeneratorImport, GeneratorSchema } from '../../types/generator';
import { pascal } from '../../utils/case';
import { resolveValue } from '../resolvers/value';
import { getEnum } from './enum';
import { getKey } from './keys';

type QueryParamsType = {
  definition: string;
  imports: GeneratorImport[];
  schemas: GeneratorSchema[];
};

const getQueryParamsTypes = (
  queryParams: (ParameterObject | GeneratorImport)[],
  definitionName: string,
  target: InputTarget,
): Promise<QueryParamsType[]> => {
  return Promise.all(
    queryParams.map(async (p) => {
      const { name, required, schema } = p as {
        name: string;
        required: boolean;
        schema: SchemaObject;
      };

      const { value, imports, isEnum, type, schemas } = await resolveValue({
        schema: schema!,
        target,
        name: pascal(definitionName) + pascal(name),
      });

      const key = getKey(name);

      if (isEnum) {
        const enumName = pascal(definitionName) + pascal(name);
        const enumValue = getEnum(value, type, enumName);

        return {
          definition: `${key}${
            !required || schema.default ? '?' : ''
          }: ${enumName}`,
          imports: [{ name: enumName }],
          schemas: [...schemas, { name: enumName, model: enumValue, imports }],
        };
      }

      const definition = `${key}${
        !required || schema.default ? '?' : ''
      }: ${value}`;

      return {
        definition,
        imports,
        schemas,
      };
    }),
  );
};

export const getQueryParams = async ({
  queryParams = [],
  definitionName,
  target,
}: {
  queryParams: ParameterObject[];
  definitionName: string;
  target: InputTarget;
}): Promise<
  { schema: GeneratorSchema; deps: GeneratorSchema[] } | undefined
> => {
  if (!queryParams.length) {
    return;
  }
  const types = await getQueryParamsTypes(queryParams, definitionName, target);
  const imports = types.reduce<GeneratorImport[]>(
    (acc, { imports = [] }) => [...acc, ...imports],
    [],
  );
  const schemas = types.reduce<GeneratorSchema[]>(
    (acc, { schemas = [] }) => [...acc, ...schemas],
    [],
  );
  const name = `${pascal(definitionName)}Params`;

  const type = types.map(({ definition }) => definition).join('; ');

  const schema = {
    name,
    model: `export type ${name} = { ${type} };\n`,
    imports,
  };

  return {
    schema,
    deps: schemas,
  };
};
