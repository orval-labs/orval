import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { isReference } from '../../utils/is';
import { getScalar } from '../getters/scalar';
import { resolveRef } from './ref';

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
    const { schema: schemaObject, imports } = await resolveRef<SchemaObject>(
      schema,
      context,
    );
    const { name, specKey, schemaName } = imports[0];

    return {
      value: name,
      imports: [{ name, specKey: specKey || context.specKey, schemaName }],
      type: schemaObject?.type || 'object',
      schemas: [],
      isEnum: !!schemaObject?.enum,
      originalSchema: schemaObject,
      isRef: true,
    };
  }

  const scalar = await getScalar({ item: schema, name, context });

  return {
    ...scalar,
    originalSchema: schema,
    isRef: false,
  };
};
