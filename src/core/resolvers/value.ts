import { ReferenceObject, SchemaObject } from 'openapi3-ts';
import { ContextSpecs } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { isReference } from '../../utils/is';
import { getScalar } from '../getters/scalar';
import { resolveRef } from './ref';

export const resolveValue = ({
  schema,
  name,
  context,
}: {
  schema: SchemaObject | ReferenceObject;
  name?: string;
  context: ContextSpecs;
}): ResolverValue => {
  if (isReference(schema)) {
    const { schema: schemaObject, imports } = resolveRef<SchemaObject>(
      schema,
      context,
    );
    const { name, specKey, schemaName } = imports[0];

    const importSpecKey =
      specKey ||
      (context.specKey !== context.target ? context.specKey : undefined);

    return {
      value: name,
      imports: [{ name, specKey: importSpecKey, schemaName }],
      type: schemaObject?.type || 'object',
      schemas: [],
      isEnum: !!schemaObject?.enum,
      originalSchema: schemaObject,
      isRef: true,
    };
  }

  const scalar = getScalar({ item: schema, name, context });

  return {
    ...scalar,
    originalSchema: schema,
    isRef: false,
  };
};
