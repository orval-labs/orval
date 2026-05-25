import { getScalar } from '../getters';
import type { FormDataContext } from '../getters/object';
import { isComponentRef } from '../getters/ref';
import { isBinaryScalarSchema } from '../getters/scalar';
import type {
  ContextSpec,
  GeneratorImport,
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
    const refValue = schema.$ref;
    const {
      schema: schemaObject,
      imports,
    }: {
      schema: OpenApiSchemaObject;
      imports: GeneratorImport[];
    } = resolveRef(schema, context);

    // Refs that don't target a named component slot (e.g. bundler-emitted
    // `#/paths/.../schema`) have no corresponding `export type`, so emitting
    // a named import would dangle. Inline the resolved schema instead.
    // See issue #398.
    if (refValue && !isComponentRef(refValue)) {
      // Inlining walks nested $refs via getScalar -> resolveValue. A
      // self-referential path-ref would recurse forever because the named-ref
      // cycle guard below tracks `resolvedImport.name`, not the ref string.
      // Fall back to `unknown` to break the chain — anonymous recursive types
      // can't be expressed in TypeScript anyway.
      if (context.parents?.includes(refValue)) {
        return {
          value: 'unknown',
          imports: [],
          schemas: [],
          type: 'unknown',
          isEnum: false,
          originalSchema: schemaObject,
          hasReadonlyProps: false,
          isRef: false,
          dependencies: [],
        };
      }
      const scalar = getScalar({
        item: schemaObject,
        name,
        context: {
          ...context,
          parents: [...(context.parents ?? []), refValue],
        },
        formDataContext,
      });
      return { ...scalar, originalSchema: schemaObject, isRef: false };
    }

    // application/x-www-form-urlencoded bodies are serialized via
    // URLSearchParams.append(), which only accepts strings. Inline binary
    // properties already skip the Blob coercion via formDataContext.urlEncoded
    // inside scalar.ts (#1624 / #3395), but the component-$ref path below
    // returns the imported type name unconditionally — so e.g. C#'s
    // `IFormFile` (= Blob) leaks into the body type and fails to type-check.
    // When the resolved component schema is a binary scalar that scalar.ts
    // would coerce to Blob, fall back to the inlined scalar (which becomes
    // `string` under formDataContext.urlEncoded) instead of the import.
    // The standalone IFormFile model is intentionally left as Blob — it may
    // still be referenced by a multipart/form-data endpoint where Blob is
    // correct. Fixes #2410.
    if (formDataContext?.urlEncoded && isBinaryScalarSchema(schemaObject)) {
      // Pass the resolveValue input `name` (the property name) so this branch
      // truly behaves like an inline property schema. Using the component
      // import name here would leak component-based naming into downstream
      // scalar paths (validators/docs/naming) even though the resulting type
      // is plain `string`.
      const scalar = getScalar({
        item: schemaObject,
        name,
        context,
        formDataContext,
      });
      return { ...scalar, originalSchema: schemaObject, isRef: false };
    }

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

    const schemaType = schemaObject.type as string | string[] | undefined;
    const nullable =
      (Array.isArray(schemaType) && schemaType.includes('null')) ||
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
