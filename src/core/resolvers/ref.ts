import get from 'lodash.get';
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
  Schema extends ComponentObject = ComponentObject,
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

  const { name, originalName, specKey, refPaths } = await getRefInfo(
    schema.$ref,
    context,
  );

  const currentSchema = get(
    context.specs[specKey || context.specKey],
    refPaths,
  ) as Schema;

  if (!currentSchema) {
    throw `Oups... 🍻. Ref not found: ${schema.$ref}`;
  }

  return resolveRef<Schema>(
    currentSchema,
    { ...context, specKey: specKey || context.specKey },
    [...imports, { name, specKey, schemaName: originalName }],
  );
};
