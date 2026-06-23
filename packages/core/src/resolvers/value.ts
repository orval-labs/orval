import { getScalar } from '../getters';
import type { FormDataContext } from '../getters/object';
import {
  getDynamicAnchorName,
  getRefInfo,
  isComponentRef,
} from '../getters/ref';
import { isBinaryScalarSchema } from '../getters/scalar';
import type {
  ContextSpec,
  GeneratorImport,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResolverValue,
  SchemaType,
} from '../types';
import { isDynamicReference, isReference } from '../utils';
import { extractBoundAliasInfo, resolveDynamicRef, resolveRef } from './ref';

interface ResolveValueOptions {
  schema: OpenApiSchemaObject | OpenApiReferenceObject;
  name?: string;
  context: ContextSpec;
  formDataContext?: FormDataContext;
}

const schemaArrayKeys = ['allOf', 'anyOf', 'oneOf', 'prefixItems'] as const;
const schemaObjectKeys = [
  'additionalProperties',
  'contains',
  'else',
  'if',
  'items',
  'not',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
] as const;
const schemaMapKeys = [
  '$defs',
  'dependentSchemas',
  'patternProperties',
  'properties',
] as const;

/**
 * Recursively walks a schema value and returns `true` if any nested
 * `$dynamicRef` resolves — via the current `context.dynamicScope` — to a
 * schema *other* than `refName`.
 *
 * Used by `resolveValue` to decide whether a `$ref`'d schema must be
 * instantiated with its bound type arguments rather than referenced by name.
 *
 * @param value   - The schema node (or sub-node) to inspect.
 * @param context - Current resolution context, including the dynamic scope.
 * @param refName - The resolved name of the enclosing `$ref` schema; dynamic
 *                  refs that resolve to this same name are considered
 *                  self-references and do not count as "scope-affected".
 * @param seen    - Cycle-guard; tracks already-visited objects.
 */
function hasScopeAffectedDynamicRef(
  value: unknown,
  context: ContextSpec,
  refName: string,
  seen = new WeakSet<object>(),
): boolean {
  if (!value || typeof value !== 'object') {
    return false;
  }

  if (!context.dynamicScope || Object.keys(context.dynamicScope).length === 0) {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (isDynamicReference(value) && value.$dynamicRef.startsWith('#')) {
    const anchorName = getDynamicAnchorName(value.$dynamicRef);
    if (anchorName) {
      const scopeEntry = context.dynamicScope[anchorName];
      if (scopeEntry && scopeEntry.name !== refName) {
        return true;
      }
    }
  }

  const schema = value as Record<string, unknown>;

  for (const key of schemaArrayKeys) {
    const items = schema[key];
    if (
      Array.isArray(items) &&
      items.some((item) =>
        hasScopeAffectedDynamicRef(item, context, refName, seen),
      )
    ) {
      return true;
    }
  }

  for (const key of schemaObjectKeys) {
    if (hasScopeAffectedDynamicRef(schema[key], context, refName, seen)) {
      return true;
    }
  }

  for (const key of schemaMapKeys) {
    const schemaMap = schema[key];
    if (
      schemaMap &&
      typeof schemaMap === 'object' &&
      Object.values(schemaMap).some((item) =>
        hasScopeAffectedDynamicRef(item, context, refName, seen),
      )
    ) {
      return true;
    }
  }

  return false;
}

function makeUnknownValue(
  originalSchema: OpenApiSchemaObject | OpenApiReferenceObject,
): ResolverValue {
  return {
    value: 'unknown',
    imports: [],
    type: 'unknown',
    isEnum: false,
    schemas: [],
    isRef: false,
    hasReadonlyProps: false,
    originalSchema,
    dependencies: [],
  };
}

/**
 * Resolves an OpenAPI schema or reference object to a {@link ResolverValue}
 * that carries the TypeScript type string, required imports, and metadata.
 *
 * Handles all schema forms in priority order:
 * 1. **Bound generic alias** — a `$ref` with `$defs` overrides; emits an
 *    instantiated generic expression such as `Paginated<User>`.
 * 2. **Component `$ref`** — a named `$ref` pointing to `#/components/…`;
 *    emits the schema name as a reference import.
 * 3. **Non-component `$ref`** — an anonymous or path-level ref; inlines the
 *    resolved schema via {@link getScalar} (cycle-safe).
 * 4. **`$dynamicRef`** — resolved via the active dynamic scope; falls back to
 *    `unknown` when the anchor is absent or the ref is a bare `#`.
 * 5. **Plain schema** — delegates to {@link getScalar} for all other cases
 *    (primitives, objects, arrays, enums, …).
 */
export function resolveValue({
  schema,
  name,
  context,
  formDataContext,
}: ResolveValueOptions): ResolverValue {
  if (isReference(schema)) {
    const alias = extractBoundAliasInfo(schema, context);
    if (alias) {
      const value = `${alias.genericName}<${alias.typeArgs.join(', ')}>`;
      const allImports: { name: string; schemaName: string }[] = [
        { name: alias.genericName, schemaName: alias.genericName },
        ...alias.imports,
      ];
      return {
        value,
        imports: allImports,
        type: 'object',
        schemas: [],
        isEnum: false,
        originalSchema: schema as OpenApiSchemaObject,
        hasReadonlyProps: false,
        isRef: true,
        dependencies: allImports.map((i) => i.name),
      };
    }

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

    // Keep the dynamic scope from the original wrapper schema: its $defs
    // provide the dynamic-anchor bindings, and scopedContext captured them
    // before materialization. Resolving the wrapper $ref here gives us the
    // concrete instantiation of the referenced template to generate.
    let effectiveContext = context;

    const schemaRecord = schemaObject as Record<string, unknown>;
    const refAnchor = schemaRecord.$dynamicAnchor as string | undefined;

    if (
      typeof refAnchor === 'string' &&
      context.dynamicScope?.[refAnchor] &&
      context.dynamicScope[refAnchor].name !== refName &&
      !context.dynamicScope[refAnchor].isParameter &&
      // Inline overrides have no component source (`schemaName` is the anchor
      // name, not a component key), so the allOf-derivation below does not
      // apply to them.
      !context.dynamicScope[refAnchor].inlineSchema
    ) {
      const scopeEntry = context.dynamicScope[refAnchor];
      const specSchemas = (
        (context.spec as Record<string, unknown>).components as
          | Record<string, unknown>
          | undefined
      )?.schemas as Record<string, unknown> | undefined;

      const scopeSource = specSchemas?.[scopeEntry.schemaName] as
        | Record<string, unknown>
        | undefined;

      const allOf = scopeSource?.allOf as unknown[] | undefined;

      const isInAllOf =
        Array.isArray(allOf) &&
        allOf.some((el) => {
          if (!el || typeof el !== 'object') return false;
          const rec = el as Record<string, unknown>;
          if (typeof rec.$ref !== 'string' || !isComponentRef(rec.$ref))
            return false;
          const { name } = getRefInfo(rec.$ref, context);
          return name === refName;
        });

      if (!isInAllOf) {
        const filteredScope = Object.fromEntries(
          Object.entries(context.dynamicScope).filter(
            ([key]) => key !== refAnchor,
          ),
        );
        effectiveContext = { ...context, dynamicScope: filteredScope };
      }
    }

    if (
      !effectiveContext.parents?.includes(refName) &&
      hasScopeAffectedDynamicRef(schemaObject, effectiveContext, refName)
    ) {
      const scalar = getScalar({
        item: schemaObject,
        name: name ?? refName,
        context: {
          ...effectiveContext,
          parents: [...(effectiveContext.parents ?? []), refName],
        },
        formDataContext,
      });

      return {
        ...scalar,
        originalSchema: schemaObject,
        isRef: false,
      };
    }

    if (!effectiveContext.parents?.includes(refName)) {
      const scalar = getScalar({
        item: schemaObject,
        name: refName,
        context: {
          ...effectiveContext,
          parents: [...(effectiveContext.parents ?? []), refName],
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

  if (isDynamicReference(schema)) {
    const dynamicRef = schema.$dynamicRef;

    if (!dynamicRef.startsWith('#')) {
      return makeUnknownValue(schema);
    }

    const anchorName = getDynamicAnchorName(dynamicRef);
    if (!anchorName) {
      return makeUnknownValue(schema);
    }

    const { imports: resolvedImports, resolvedTypeName } = resolveDynamicRef(
      anchorName,
      context,
    );

    if (resolvedTypeName === 'unknown') {
      return makeUnknownValue(schema);
    }

    return {
      value: resolvedTypeName,
      imports: resolvedImports,
      type: 'object',
      isEnum: false,
      schemas: [],
      isRef: true,
      hasReadonlyProps: false,
      originalSchema: schema,
      dependencies: [resolvedTypeName],
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
