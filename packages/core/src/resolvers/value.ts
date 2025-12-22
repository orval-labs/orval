import { getScalar } from '../getters';
import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResolverValue,
  SchemaType,
} from '../types';
import { isReference } from '../utils';
import { resolveRef } from './ref';

interface ResolveValueOptions {
  schema: OpenApiSchemaObject | OpenApiReferenceObject;
  name?: string;
  context: ContextSpec;
}

export function resolveValue({
  schema,
  name,
  context,
}: ResolveValueOptions): ResolverValue {
  if (isReference(schema)) {
    const { schema: schemaObject, imports } = resolveRef<OpenApiSchemaObject>(
      schema,
      context,
    );

    const resolvedImport = imports[0];

    let hasReadonlyProps = false;

    // Avoid infinite loop
    if (!name || !context.parents?.includes(name)) {
      const scalar = getScalar({
        item: schemaObject,
        name: resolvedImport.name,
        context: {
          ...context,
          ...(name ? { parents: [...(context.parents ?? []), name] } : {}),
        },
      });

      hasReadonlyProps = scalar.hasReadonlyProps;
    }

    const nullable =
      Array.isArray(schemaObject.type) && schemaObject.type.includes('null')
        ? ' | null'
        : '';

    return {
      value: resolvedImport.name + nullable,
      imports: [
        {
          name: resolvedImport.name,
          schemaName: resolvedImport.schemaName,
        },
      ],
      type: (schemaObject.type as SchemaType | undefined) ?? 'object',
      schemas: [],
      isEnum: !!schemaObject.enum,
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
}
