import {
  ParameterObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { isReference } from '../../utils/is';
import { getRefInfo } from '../getters/ref';

type ComponentObject =
  | SchemaObject
  | ResponseObject
  | ParameterObject
  | RequestBodyObject;
export const resolveRef = async <
  Schema extends ComponentObject = ComponentObject
>(
  schema: ComponentObject,
  context: ContextSpecs,
  imports: GeneratorImport[] = [],
): Promise<{
  schema: Schema;
  imports: GeneratorImport[];
}> => {
  if (!isReference(schema)) {
    return { schema: schema as Schema, imports };
  }

  const { name, originalName, specKey, type } = await getRefInfo(
    schema.$ref,
    context,
  );

  const currentSchema = context.specs[specKey || context.specKey]?.components?.[
    type
  ]?.[originalName]! as Schema;

  if (!currentSchema) {
    throw `Oups... 🍻. Ref not found: ${schema.$ref}`;
  }

  return resolveRef<Schema>(
    currentSchema,
    { ...context, specKey: specKey || context.specKey },
    [...imports, { name, specKey, schemaName: originalName }],
  );
};
