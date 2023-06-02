import get from 'lodash.get';
import {
  ParameterObject,
  ReferenceObject,
  RequestBodyObject,
  ResponseObject,
  SchemaObject,
} from 'openapi3-ts';
import { getRefInfo } from '../getters/ref';
import { ContextSpecs, GeneratorImport } from '../types';
import { isReference } from '../utils';

type ComponentObject =
  | SchemaObject
  | ResponseObject
  | ParameterObject
  | RequestBodyObject
  | ReferenceObject;
export const resolveRef = <Schema extends ComponentObject = ComponentObject>(
  schema: ComponentObject,
  context: ContextSpecs,
  imports: GeneratorImport[] = [],
): {
  schema: Schema;
  imports: GeneratorImport[];
} => {
  // the schema is refering to another object
  if ((schema as any)?.schema?.$ref) {
    const resolvedRef = resolveRef<Schema>(
      (schema as any)?.schema,
      context,
      imports,
    );
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

  const { currentSchema, specKey, name, originalName } = getSchema(
    schema,
    context,
  );

  if (!currentSchema) {
    throw `Oups... 🍻. Ref not found: ${schema.$ref}`;
  }

  return resolveRef<Schema>(
    currentSchema,
    { ...context, specKey: specKey || context.specKey },
    [...imports, { name, specKey, schemaName: originalName }],
  );
};

function getSchema<Schema extends ComponentObject = ComponentObject>(
  schema: ReferenceObject,
  context: ContextSpecs,
): {
  specKey: string | undefined;
  name: string;
  originalName: string;
  currentSchema: Schema | undefined;
} {
  const { name, originalName, specKey, refPaths } = getRefInfo(
    schema.$ref,
    context,
  );

  const schemaByRefPaths: Schema | undefined =
    refPaths && get(context.specs[specKey || context.specKey], refPaths);
  if (isReferenceObject(schemaByRefPaths)) {
    return getSchema(schemaByRefPaths, context);
  }
  const currentSchema = schemaByRefPaths
    ? schemaByRefPaths
    : (context.specs[specKey || context.specKey] as unknown as Schema);
  return {
    currentSchema,
    name,
    originalName,
    specKey,
  };
}

function isReferenceObject(
  schema: ComponentObject | undefined,
): schema is ReferenceObject {
  return !!schema && !!(schema as ReferenceObject).$ref;
}
