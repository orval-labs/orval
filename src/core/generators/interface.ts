import { SchemaObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { ContextSpecs } from '../../types';
import { pascal } from '../../utils/case';
import { jsDoc } from '../../utils/doc';
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
  context,
  suffix,
}: {
  name: string;
  schema: SchemaObject;
  context: ContextSpecs;
  suffix: string;
}) => {
  const scalar = await getScalar({ item: schema, name, context });
  const isEmptyObject = scalar.value === '{}';
  const definitionName = pascal(name) + suffix;

  let model = '';

  model += jsDoc(schema);

  if (isEmptyObject) {
    model += '// tslint:disable-next-line:no-empty-interface\n';
  }

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
