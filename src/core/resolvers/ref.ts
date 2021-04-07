import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { GeneratorImport } from '../../types/generator';
import { isReference } from '../../utils/is';
import { getRefInfo } from '../getters/ref';

export const resolveRef = async (
  schema: SchemaObject | ReferenceObject,
  context: ContextSpecs,
  imports: GeneratorImport[] = [],
): Promise<SchemaObject> => {
  if (!isReference(schema)) {
    return { schema, imports };
  }

  const { name, specKey } = await getRefInfo(schema.$ref, context);

  return resolveRef(
    context.specs[specKey || context.specKey].components?.schemas?.[name]!,
    { ...context, specKey: specKey || context.specKey },
    [...imports, { name, specKey }],
  );
};
