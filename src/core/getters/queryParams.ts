import { ParameterObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
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
  operationName: string,
  context: ContextSpecs,
): Promise<QueryParamsType[]> => {
  return Promise.all(
    queryParams.map(async (p) => {
      const { name, required, schema } = p as {
        name: string;
        required: boolean;
        schema: SchemaObject;
      };

      const { value, imports, isEnum, type, schemas, ref } = await resolveValue({
        schema: schema!,
        context,
        name: pascal(operationName) + pascal(name),
      });

      const key = getKey(name);

      if (isEnum && !ref) {
        const enumName = pascal(operationName) + pascal(name);
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
  operationName,
  context,
}: {
  queryParams: ParameterObject[];
  operationName: string;
  context: ContextSpecs;
}): Promise<
  { schema: GeneratorSchema; deps: GeneratorSchema[] } | undefined
> => {
  if (!queryParams.length) {
    return;
  }
  const types = await getQueryParamsTypes(queryParams, operationName, context);
  const imports = types.reduce<GeneratorImport[]>(
    (acc, { imports = [] }) => [...acc, ...imports],
    [],
  );
  const schemas = types.reduce<GeneratorSchema[]>(
    (acc, { schemas = [] }) => [...acc, ...schemas],
    [],
  );
  const name = `${pascal(operationName)}Params`;

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
