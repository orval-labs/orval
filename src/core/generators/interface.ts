import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { OverrideOutput } from '../../types';
import { pascal } from '../../utils/case';
import { generalTypesFilter } from '../../utils/filters';
import { getScalar } from '../getters/scalar';

/**
 * Generate the interface string
 * A tslint comment is insert if the resulted object is empty
 *
 * @param name interface name
 * @param schema
 */
export const generateInterface = ({
  name,
  schema,
  schemas,
  override,
}: {
  name: string;
  schema: SchemaObject;
  schemas: SchemasObject;
  override: OverrideOutput;
}) => {
  const scalar = getScalar({ item: schema, name, schemas, override });
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
    (importName) => importName !== definitionName,
  );

  return [
    ...scalar.schemas,
    {
      name: definitionName,
      model,
      imports: generalTypesFilter(externalModulesImportsOnly),
    },
  ];
};
