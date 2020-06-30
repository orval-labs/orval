import { ParameterObject, ReferenceObject, SchemaObject } from 'openapi3-ts';
import { GeneratorSchema } from '../../types/generator';
import { pascal, upper } from '../../utils/case';
import { sanitize } from '../../utils/string';
import { resolveValue } from '../resolvers/value';
import { getKey } from './keys';

const getQueryParamsTypes = (
  queryParams: (ParameterObject | ReferenceObject)[],
  definitionName: string,
) => {
  return queryParams.map((p) => {
    const { name, required, schema } = p as {
      name: string;
      required: boolean;
      schema: SchemaObject;
    };

    const { value, imports, isEnum, type } = resolveValue(schema!);

    const key = getKey(name);

    if (isEnum) {
      const enumName = pascal(definitionName) + pascal(name);
      let enumValue = `export type ${enumName} = ${value};\n`;

      const implementation = value.split(' | ').reduce((acc, val) => {
        return (
          acc +
          `  ${
            type === 'number' ? `${upper(type)}_${val}` : sanitize(val)
          }: ${val} as ${enumName},\n`
        );
      }, '');

      enumValue += `\n\nexport const ${enumName} = {\n${implementation}};\n`;

      return {
        definition: `${key}${
          !required || schema.default ? '?' : ''
        }: ${enumName}`,
        imports: [enumName],
        schemas: [{ name: enumName, model: enumValue, imports }],
      };
    }

    const definition = `${key}${
      !required || schema.default ? '?' : ''
    }: ${value}`;

    return {
      definition,
      imports,
      schemas: [],
    };
  });
};

export const getQueryParams = (
  queryParams: (ParameterObject | ReferenceObject)[] = [],
  definitionName: string,
): { schema: GeneratorSchema; deps: GeneratorSchema[] } | undefined => {
  if (!queryParams.length) {
    return;
  }
  const types = getQueryParamsTypes(queryParams, definitionName);
  const imports = types.reduce<string[]>(
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
