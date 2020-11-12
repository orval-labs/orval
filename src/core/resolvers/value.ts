import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { isReference } from '../../utils/is';
import { getRef } from '../getters/ref';
import { getScalar } from '../getters/scalar';

/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
export const resolveValue = ({
  schema,
  name,
  schemas = {},
}: {
  schema: SchemaObject;
  name?: string;
  schemas?: SchemasObject;
}): ResolverValue => {
  if (isReference(schema)) {
    const value = getRef(schema.$ref);
    const schemaObject = schemas[value];
    return {
      value,
      imports: [value],
      type: schemaObject?.type || 'object',
      schemas: [],
      isEnum: !!schemaObject?.enum,
    };
  }

  return getScalar(schema, name, schemas);
};
