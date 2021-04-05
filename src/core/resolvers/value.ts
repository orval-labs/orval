import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { InputTarget } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { isReference } from '../../utils/is';
import { getRefInfo } from '../getters/ref';
import { getScalar } from '../getters/scalar';

/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
export const resolveValue = async ({
  schema,
  name,
  schemas = {},
  target,
}: {
  schema: SchemaObject;
  name?: string;
  schemas?: SchemasObject;
  target: InputTarget;
}): Promise<ResolverValue> => {
  if (isReference(schema)) {
    const { name, specKey } = await getRefInfo(schema.$ref, target);
    const schemaObject = schemas[name];
    return {
      value: name,
      imports: [{ name, specKey }],
      type: schemaObject?.type || 'object',
      schemas: [],
      isEnum: !!schemaObject?.enum,
    };
  }

  return getScalar({ item: schema, name, schemas, target });
};
