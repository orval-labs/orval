import { isBooleanJsonSchema } from '@scalar/openapi-types/helpers';

import { getScalar } from '../getters';
import type { FormDataContext } from '../getters/object';
import type {
  ContextSpec,
  GeneratorSchema,
  OpenApiSchemaObject,
} from '../types';
import { jsDoc } from '../utils';

interface GenerateInterfaceOptions {
  name: string;
  schema: OpenApiSchemaObject;
  context: ContextSpec;
  /**
   * Multipart/form-data context, set when the schema is used as a shared
   * `multipart/form-data` request body (#4177).
   *
   * @see FormDataContext
   */
  formDataContext?: FormDataContext;
  genericParams?: string[];
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
  formDataContext,
  genericParams,
}: GenerateInterfaceOptions): GeneratorSchema[] {
  const scalar = getScalar({
    item: schema,
    name,
    context,
    formDataContext,
  });
  const isEmptyObject = scalar.value === '{}';
  const shouldUseTypeAlias =
    context.output.override.useTypeOverInterfaces ?? scalar.useTypeAlias;
  const genericSuffix =
    genericParams && genericParams.length > 0
      ? `<${genericParams.join(', ')}>`
      : '';

  let model = '';

  if (!isBooleanJsonSchema(schema)) {
    model += jsDoc(schema);
  }

  if (isEmptyObject) {
    model +=
      '// eslint-disable-next-line @typescript-eslint/no-empty-interface\n';
  }

  if (
    scalar.type === 'object' &&
    !shouldUseTypeAlias &&
    !isBooleanJsonSchema(schema)
  ) {
    const properties = schema.properties;
    if (
      properties &&
      Object.values(properties).length > 0 &&
      Object.values(properties).every(
        (item) => !isBooleanJsonSchema(item) && 'const' in item,
      )
    ) {
      const mappedScalarValue = scalar.value
        .replaceAll(';', ',')
        .replaceAll('?:', ':');

      model += `export const ${name}Value = ${mappedScalarValue} as const;\nexport type ${name}${genericSuffix} = typeof ${name}Value;\n`;
    } else {
      const blankInterfaceValue =
        scalar.value === 'unknown' ? '{}' : scalar.value;

      model += `export interface ${name}${genericSuffix} ${blankInterfaceValue}\n`;
    }
  } else {
    model += `export type ${name}${genericSuffix} = ${scalar.value};\n`;
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
      kind: 'schema',
    },
  ];
}
