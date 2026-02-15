import { getScalar } from '../getters';
import type { FormDataContext } from '../getters/object';
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
  formDataContext?: FormDataContext;
}

export function resolveValue({
  schema,
  name,
  context,
  formDataContext,
}: ResolveValueOptions): ResolverValue {
  if (isReference(schema)) {
    const { schema: schemaObject, imports } = resolveRef<OpenApiSchemaObject>(
      schema,
      context,
    );

    const resolvedImport = imports[0];

    let hasReadonlyProps = false;

    // Avoid infinite loop - use resolvedImport.name for tracking since name may be undefined
    const refName = resolvedImport.name;
    if (!context.parents?.includes(refName)) {
      const scalar = getScalar({
        item: schemaObject,
        name: refName,
        context: {
          ...context,
          parents: [...(context.parents ?? []), refName],
        },
      });

      hasReadonlyProps = scalar.hasReadonlyProps;
    }

    // Bridge assertion: schemaObject.anyOf is `any` due to AnyOtherAttribute
    const anyOfItems = schemaObject.anyOf as
      | (OpenApiSchemaObject | OpenApiReferenceObject)[]
      | undefined;
    const isAnyOfNullable = anyOfItems?.some(
      (anyOfItem) =>
        !isReference(anyOfItem) &&
        (anyOfItem.type === 'null' ||
          (Array.isArray(anyOfItem.type) && anyOfItem.type.includes('null'))),
    );

    const nullable =
      (Array.isArray(schemaObject.type) &&
        schemaObject.type.includes('null')) ||
      schemaObject.nullable === true ||
      isAnyOfNullable
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

  const scalar = getScalar({
    item: schema,
    name,
    context,
    formDataContext,
  });

  return {
    ...scalar,
    originalSchema: schema,
    isRef: false,
  };
}
