import { SchemaObject } from 'openapi3-ts';
import { generalJSTypesWithArray } from '../../constants';
import { ContextSpecs } from '../../types';
import { jsDoc } from '../../utils/doc';
import { getScalar } from '../getters/scalar';

/**
 * Generate the interface string
 * A eslint|tslint comment is insert if the resulted object is empty
 *
 * @param name interface name
 * @param schema
 */
export const generateInterface = ({
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
  const scalar = getScalar({
    item: schema,
    name,
    context,
  });
  const isEmptyObject = scalar.value === '{}';

  let model = '';

  model += jsDoc(schema);

  if (isEmptyObject) {
    if (context.tslint) {
      model += '// tslint:disable-next-line:no-empty-interface\n';
    } else {
      model +=
        '// eslint-disable-next-line @typescript-eslint/no-empty-interface\n';
    }
  }

  if (
    !generalJSTypesWithArray.includes(scalar.value) &&
    !context?.override?.useTypeOverInterfaces
  ) {
    model += `export interface ${name} ${scalar.value}\n`;
  } else {
    model += `export type ${name} = ${scalar.value};\n`;
  }

  // Filter out imports that refer to the type defined in current file (OpenAPI recursive schema definitions)
  const externalModulesImportsOnly = scalar.imports.filter(
    (importName) => importName.name !== name,
  );

  return [
    ...scalar.schemas,
    {
      name,
      model,
      imports: externalModulesImportsOnly,
    },
  ];
};
