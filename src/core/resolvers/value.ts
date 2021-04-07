import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { isReference } from '../../utils/is';
import { getScalar } from '../getters/scalar';
import { resolveRef } from './ref';

/**
 * Resolve the value of a schema object to a proper type definition.
 * @param schema
 */
export const resolveValue = async ({
  schema,
  name,
  context,
}: {
  schema: SchemaObject;
  name?: string;
  context: ContextSpecs;
}): Promise<ResolverValue> => {
  if (isReference(schema)) {
    const { schema: schemaObject, imports } = await resolveRef(schema, context);
    const { name, specKey } = imports[0];

    return {
      value: name,
      imports: [{ name, specKey }],
      type: schemaObject?.type || 'object',
      schemas: [],
      isEnum: !!schemaObject?.enum,
    };
  }

  return getScalar({ item: schema, name, context });
};
