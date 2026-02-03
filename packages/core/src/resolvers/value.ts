import {
  applyBrandedType,
  extractBrandInfo,
  getScalar,
  isBrandableType,
} from '../getters';
import type { FormDataContext } from '../getters/object';
import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResolverValue,
  ScalarValue,
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

    const nullable =
      (Array.isArray(schemaObject.type) &&
        schemaObject.type.includes('null')) ||
      schemaObject.nullable === true
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

  let scalar = getScalar({
    item: schema,
    name,
    context,
    formDataContext,
  });

  if (context.output.override.generateBrandedTypes) {
    scalar = maybeApplyBrandedType(scalar, schema);
  }

  return {
    ...scalar,
    originalSchema: schema,
    isRef: false,
  };
}

/**
 * Apply branding to a scalar value if the schema has x-brand and is a brandable type
 */
function maybeApplyBrandedType(
  scalar: ScalarValue,
  schema: OpenApiSchemaObject,
): ScalarValue {
  const brandInfo = extractBrandInfo(schema);

  if (!brandInfo || !isBrandableType(scalar)) {
    return scalar;
  }

  return applyBrandedType(scalar, brandInfo);
}
