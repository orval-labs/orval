import { getScalar } from '../getters';
import type { ContextSpec, OpenApiSchemaObject } from '../types';
import { jsDoc } from '../utils';

interface GenerateInterfaceOptions {
  name: string;
  schema: OpenApiSchemaObject;
  context: ContextSpec;
}

/**
 * Generate the interface string
 * An eslint comment is insert if the resulted object is empty
 *
 * @param name interface name
 * @param schema
 */
export function generateInterface({
  name,
  schema,
  context,
}: GenerateInterfaceOptions) {
  const scalar = getScalar({
    item: schema,
    name,
    context,
  });
  const isEmptyObject = scalar.value === '{}';

  let model = '';

  model += jsDoc(schema);

  if (isEmptyObject) {
    model +=
      '// eslint-disable-next-line @typescript-eslint/no-empty-interface\n';
  }

  if (
    scalar.type === 'object' &&
    !context?.output.override?.useTypeOverInterfaces
  ) {
    if (
      scalar.type === 'object' &&
      schema.properties &&
      Object.values(schema.properties).length > 0 &&
      Object.values(schema.properties).every((item) => typeof item === 'object' && item !== null && 'const' in item)
    ) {
      const mappedScalarValue = scalar.value
        .replaceAll(';', ',')
        .replaceAll('?:', ':');

      model += `export const ${name}Value = ${mappedScalarValue} as const;\nexport type ${name} = typeof ${name}Value;\n`;
    } else {
      const blankInterfaceValue =
        scalar.value === 'unknown' ? '{}' : scalar.value;

      model += `export interface ${name} ${blankInterfaceValue}\n`;
    }
  } else {
    model += `export type ${name} = ${scalar.value};\n`;
  }

  // Filter out imports that refer to the type defined in current file (OpenAPI recursive schema definitions)
  const externalModulesImportsOnly = scalar.imports.filter((importName) =>
    importName.alias ? importName.alias !== name : importName.name !== name,
  );

  return [
    ...scalar.schemas,
    {
      name,
      model,
      imports: externalModulesImportsOnly,
      dependencies: scalar.dependencies,
      schema,
    },
  ];
}
