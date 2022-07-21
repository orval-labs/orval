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
export const resolveRef = <Schema extends ComponentObject = ComponentObject>(
  schema: ComponentObject,
  context: ContextSpecs,
  imports: GeneratorImport[] = [],
): {
  schema: Schema;
  imports: GeneratorImport[];
} => {
  // the schema is refering to another object
  if (schema?.schema?.$ref) {
    const resolvedRef = resolveRef<Schema>(schema?.schema, context, imports);
    return {
      schema: {
        ...schema,
        schema: resolvedRef.schema,
      } as Schema,
      imports,
    };
  }

  if (!isReference(schema)) {
    return { schema: schema as Schema, imports };
  }

  const { name, originalName, specKey, refPaths } = getRefInfo(
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
