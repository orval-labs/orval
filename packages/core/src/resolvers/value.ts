import { ReferenceObject, SchemaObject } from 'openapi3-ts/oas30';
import { getScalar } from '../getters';
import { ContextSpecs, ResolverValue, SchemaType } from '../types';
import { isReference } from '../utils';
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

    const resolvedImport = imports[0];

    const importSpecKey =
      resolvedImport.specKey ||
      (context.specKey !== context.target ? context.specKey : undefined);

    let hasReadonlyProps = false;

    // Avoid infinite loop
    if (!name || !context.parents?.includes(name)) {
      const scalar = getScalar({
        item: schemaObject,
        name: resolvedImport.name,
        context: {
          ...context,
          specKey: importSpecKey || context.specKey,
          ...(name ? { parents: [...(context.parents || []), name] } : {}),
        },
      });

      hasReadonlyProps = scalar.hasReadonlyProps;
    }

    return {
      value: resolvedImport.name,
      imports: [
        {
          name: resolvedImport.name,
          specKey: importSpecKey,
          schemaName: resolvedImport.schemaName,
        },
      ],
      type: (schemaObject?.type as SchemaType) || 'object',
      schemas: [],
      isEnum: !!schemaObject?.enum,
      originalSchema: schemaObject,
      hasReadonlyProps,
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
