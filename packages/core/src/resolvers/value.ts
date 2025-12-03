import type { ReferenceObject, SchemaObject } from 'openapi3-ts/oas30';

import { getScalar } from '../getters/index.ts';
import { type ContextSpecs, type ResolverValue, SchemaType } from '../types.ts';
import { isReference } from '../utils/index.ts';
import { resolveRef } from './ref.ts';

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
      (context.specKey === context.target ? undefined : context.specKey);

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

    const nullable = schemaObject.nullable ? ' | null' : '';

    return {
      value: resolvedImport.name + nullable,
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
      dependencies: [resolvedImport.name],
    };
  }

  const scalar = getScalar({ item: schema, name, context });

  return {
    ...scalar,
    originalSchema: schema,
    isRef: false,
  };
};
