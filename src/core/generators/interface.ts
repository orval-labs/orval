import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { InputTarget } from '../../types';
import { pascal } from '../../utils/case';
import { getScalar } from '../getters/scalar';

/**
 * Generate the interface string
 * A tslint comment is insert if the resulted object is empty
 *
 * @param name interface name
 * @param schema
 */
export const generateInterface = async ({
  name,
  schema,
  schemas,
  target,
}: {
  name: string;
  schema: SchemaObject;
  schemas: SchemasObject;
  target: InputTarget;
}) => {
  const scalar = await getScalar({ item: schema, name, schemas, target });
  const isEmptyObject = scalar.value === '{}';
  const definitionName = pascal(name);

  let model = isEmptyObject
    ? '// tslint:disable-next-line:no-empty-interface\n'
    : '';

  if (!generalJSTypesWithArray.includes(scalar.value)) {
    model += `export interface ${definitionName} ${scalar.value}\n`;
  } else {
    model += `export type ${definitionName} = ${scalar.value};\n`;
  }

  // Filter out imports that refer to the type defined in current file (OpenAPI recursive schema definitions)
  const externalModulesImportsOnly = scalar.imports.filter(
    (importName) => importName.name !== definitionName,
  );

  return [
    ...scalar.schemas,
    {
      name: definitionName,
      model,
      imports: externalModulesImportsOnly,
    },
  ];
};
