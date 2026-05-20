import { getScalar } from '../getters';
import type { FormDataContext } from '../getters/object';
import { getDynamicAnchorName, isComponentRef } from '../getters/ref';
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

    const resolvedImport = imports[0];

    let hasReadonlyProps = false;

    // Avoid infinite loop - use resolvedImport.name for tracking since name may be undefined
    const refName = resolvedImport.name;

    // Keep the dynamic scope from the original wrapper schema: its $defs
    // provide the dynamic-anchor bindings, and scopedContext captured them
    // before materialization. Resolving the wrapper $ref here gives us the
    // concrete instantiation of the referenced template to generate.
    if (
      !context.parents?.includes(refName) &&
      hasScopeAffectedDynamicRef(schemaObject, context, refName)
    ) {
      const scalar = getScalar({
        item: schemaObject,
        name: name ?? refName,
        context: {
          ...context,
          parents: [...(context.parents ?? []), refName],
        },
        formDataContext,
      });

      return {
        ...scalar,
        originalSchema: schemaObject,
        isRef: false,
      };
    }

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
