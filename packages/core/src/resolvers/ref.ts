import { isDereferenced } from '@scalar/openapi-types/helpers';
import { prop } from 'remeda';

import { getRefInfo, isComponentRef, type RefInfo } from '../getters/ref';
import type {
  ContextSpec,
  DynamicScopeEntry,
  GeneratorImport,
  OpenApiComponentsObject,
  OpenApiExampleObject,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
} from '../types';
import { isObject, isReference, sanitize } from '../utils';

/** Convert a `$dynamicAnchor` name to a valid TypeScript generic parameter identifier. */
export function dynamicAnchorToParamName(anchor: string): string {
  return sanitize(anchor, {
    underscore: '_',
    whitespace: '_',
    dash: '_',
    es5keyword: true,
    es5IdentifierName: true,
  });
}

export function dynamicAnchorsToUniqueParamNames(
  anchors: string[],
): Map<string, string> {
  const result = new Map<string, string>();
  const usedNames = new Map<string, number>();
  for (const anchor of anchors) {
    const base = dynamicAnchorToParamName(anchor);
    const count = usedNames.get(base) ?? 0;
    usedNames.set(base, count + 1);
    const paramName = count === 0 ? base : `${base}${count + 1}`;
    result.set(anchor, paramName);
  }
  return result;
}

type Example = OpenApiExampleObject | OpenApiReferenceObject;
type ResolvedExample = unknown;
type Examples =
  | Example[]
  | Record<string, Example>
  | ResolvedExample[]
  | Record<string, ResolvedExample>
  | undefined;

interface WithOptionalExamples {
  examples?: Examples;
}

const REF_NOT_FOUND_PREFIX = 'Oops... 🍻. Ref not found';

/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters -- TSchema constrains return type for callers (e.g. resolveRef<OpenApiExampleObject>) */

/**
 * Recursively resolves a `$ref` in an OpenAPI document, following
 * nested schema refs and collecting imports along the way.
 *
 * Handles OpenAPI 3.0 `nullable` and 3.1 type-array hints on direct refs.
 *
 * @see https://spec.openapis.org/oas/v3.0.3#reference-object
 * @see https://spec.openapis.org/oas/v3.1.0#reference-object
 */
export function resolveRef<TSchema extends object = OpenApiComponentsObject>(
  schema: OpenApiComponentsObject | OpenApiReferenceObject,
  context: ContextSpec,
  imports: GeneratorImport[] = [],
): {
  schema: TSchema;
  imports: GeneratorImport[];
} {
  const refPath = '$ref' in schema ? schema.$ref : undefined;
  const nestedSchema =
    'schema' in schema ? (schema as { schema?: unknown }).schema : undefined;

  // the schema is referring to another object
  if (
    isObject(nestedSchema) &&
    isReference(nestedSchema) &&
    typeof nestedSchema.$ref === 'string'
  ) {
    const resolvedRef = resolveRef<TSchema>(nestedSchema, context, imports);

    if ('examples' in schema) {
      const schemaWithExamples = schema as WithOptionalExamples;
      schemaWithExamples.examples = resolveExampleRefs(
        schemaWithExamples.examples,
        context,
      );
    }

    if ('examples' in resolvedRef.schema) {
      const resolvedWithExamples = resolvedRef.schema as WithOptionalExamples;
      resolvedWithExamples.examples = resolveExampleRefs(
        resolvedWithExamples.examples,
        context,
      );
    }

    return {
      schema: {
        ...schema,
        schema: resolvedRef.schema,
      } as TSchema,
      imports: resolvedRef.imports,
    };
  }

  if (isDereferenced(schema)) {
    if ('examples' in schema) {
      const schemaWithExamples = schema as WithOptionalExamples;
      schemaWithExamples.examples = resolveExampleRefs(
        schemaWithExamples.examples,
        context,
      );
    }
    return { schema: schema as TSchema, imports };
  }

  if (!refPath) {
    throw new Error(`${REF_NOT_FOUND_PREFIX}: missing $ref`);
  }

  const {
    currentSchema,
    refInfo: { name, originalName },
  } = getSchema(schema, context);

  if (!currentSchema) {
    throw new Error(`${REF_NOT_FOUND_PREFIX}: ${refPath}`);
  }

  return resolveRef<TSchema>(currentSchema, { ...context }, [
    ...imports,
    { name, schemaName: originalName },
  ]);
}

/**
 * Describes a resolved generic alias binding — the concrete type arguments
 * that fill the template's `$dynamicAnchor` slots for a given `$ref` with
 * `$defs` overrides.
 *
 * Produced by {@link extractBoundAliasInfo} and consumed by `resolveValue`
 * to emit instantiated generic type expressions (e.g. `Paginated<User>`).
 */
export interface BoundAliasInfo {
  genericName: string;
  genericParams: string[];
  typeArgs: string[];
  imports: { name: string; schemaName: string }[];
  extraSchemas?: (OpenApiSchemaObject | OpenApiReferenceObject)[];
}

/** Check whether a schema reference has at least one `$defs` entry with both `$dynamicAnchor` and `$ref`. */
function isBoundAlias(schema: OpenApiReferenceObject): boolean {
  const defs = schema.$defs as Record<string, unknown> | undefined;
  if (!defs || typeof defs !== 'object') return false;
  for (const defSchema of Object.values(defs)) {
    if (!defSchema || typeof defSchema !== 'object') continue;
    const rec = defSchema as Record<string, unknown>;
    if (
      typeof rec.$dynamicAnchor === 'string' &&
      typeof rec.$ref === 'string'
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Extract bound-alias information from a schema that references a generic template
 * and binds `$dynamicAnchor` entries to concrete types via `$defs`.
 */
export function extractBoundAliasInfo(
  schema: OpenApiSchemaObject | OpenApiReferenceObject,
  context: ContextSpec,
): BoundAliasInfo | undefined {
  let bindingElement: OpenApiReferenceObject | undefined;
  let extraSchemas:
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;

  if (isReference(schema) && isBoundAlias(schema)) {
    bindingElement = schema;
  } else {
    const allOf = (schema as { allOf?: unknown[] }).allOf;
    if (Array.isArray(allOf)) {
      for (let i = 0; i < allOf.length; i++) {
        const element = allOf[i] as
          | OpenApiSchemaObject
          | OpenApiReferenceObject;
        if (isReference(element) && isBoundAlias(element)) {
          bindingElement = element;
          extraSchemas = allOf.filter((_: unknown, j: number) => j !== i) as (
            | OpenApiSchemaObject
            | OpenApiReferenceObject
          )[];
          break;
        }
      }
    }
  }

  if (!bindingElement) return undefined;

  const bindingRecord = bindingElement as Record<string, unknown>;
  const defs = bindingRecord.$defs as Record<string, unknown> | undefined;
  if (!defs || typeof defs !== 'object') return undefined;

  const bindingByAnchor = new Map<
    string,
    { typeName: string; originalName: string }
  >();

  for (const defSchema of Object.values(defs)) {
    if (!defSchema || typeof defSchema !== 'object') continue;
    const rec = defSchema as Record<string, unknown>;
    if (rec.$dynamicAnchor === undefined) continue;

    const ref = rec.$ref as string | undefined;
    if (!ref || !isComponentRef(ref)) continue;

    const anchor = rec.$dynamicAnchor as string;
    const { name, originalName } = getRefInfo(ref, context);
    bindingByAnchor.set(anchor, { typeName: name, originalName });
  }

  if (bindingByAnchor.size === 0) return undefined;

  const refPath = bindingElement.$ref;
  if (typeof refPath !== 'string') return undefined;

  const { name: genericName, refPaths: templateRefPaths } = getRefInfo(
    refPath,
    context,
  );

  const templateSchema = templateRefPaths
    ? (prop(
        context.spec,
        // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
        ...templateRefPaths,
      ) as Record<string, unknown> | undefined)
    : undefined;

  const templateDefs = templateSchema?.$defs as
    | Record<string, unknown>
    | undefined;

  const typeArgs: string[] = [];
  const genericParams: string[] = [];
  const imports: { name: string; schemaName: string }[] = [];

  if (templateDefs && typeof templateDefs === 'object') {
    const templateAnchors: string[] = [];
    for (const defSchema of Object.values(templateDefs)) {
      if (!defSchema || typeof defSchema !== 'object') continue;
      const rec = defSchema as Record<string, unknown>;
      if (rec.$dynamicAnchor === undefined || rec.$ref !== undefined) continue;
      templateAnchors.push(rec.$dynamicAnchor as string);
    }

    const uniqueNames = dynamicAnchorsToUniqueParamNames(templateAnchors);
    for (const anchor of templateAnchors) {
      const binding = bindingByAnchor.get(anchor);
      if (binding) {
        typeArgs.push(binding.typeName);
        imports.push({
          name: binding.typeName,
          schemaName: binding.originalName,
        });
      } else {
        const paramName =
          uniqueNames.get(anchor) ?? dynamicAnchorToParamName(anchor);
        typeArgs.push(paramName);
        genericParams.push(paramName);
      }
    }
  }

  if (typeArgs.length === 0) {
    for (const { typeName, originalName } of bindingByAnchor.values()) {
      typeArgs.push(typeName);
      imports.push({ name: typeName, schemaName: originalName });
    }
  }

  return { genericName, genericParams, typeArgs, imports, extraSchemas };
}

function getSchema<TSchema extends object = OpenApiComponentsObject>(
  schema: OpenApiReferenceObject,
  context: ContextSpec,
): {
  refInfo: RefInfo;
  currentSchema: TSchema | undefined;
} {
  if (!schema.$ref) {
    throw new Error(`${REF_NOT_FOUND_PREFIX}: missing $ref`);
  }

  const refInfo = getRefInfo(schema.$ref, context);

  const { refPaths } = refInfo;

  const schemaByRefPaths:
    | OpenApiSchemaObject
    | OpenApiReferenceObject
    | undefined = Array.isArray(refPaths)
    ? (prop(
        context.spec,
        // @ts-expect-error: [ts2556] refPaths are not guaranteed to be valid keys of the spec
        ...refPaths,
      ) as OpenApiSchemaObject | OpenApiReferenceObject | undefined)
    : undefined;

  if (isObject(schemaByRefPaths) && isReference(schemaByRefPaths)) {
    return getSchema(schemaByRefPaths, context);
  }

  let currentSchema: OpenApiSchemaObject | OpenApiReferenceObject | undefined =
    schemaByRefPaths;

  // Handle OpenAPI 3.0 nullable property
  // Bridge assertion: schema properties are `any` due to AnyOtherAttribute
  if (isObject(currentSchema) && 'nullable' in schema) {
    const nullable = schema.nullable as boolean | undefined;
    const currentSchemaObject = currentSchema as Record<string, unknown>;
    currentSchema = {
      ...currentSchemaObject,
      nullable,
    } as OpenApiSchemaObject | OpenApiReferenceObject;
  }

  // Handle OpenAPI 3.1 type array (e.g., type: ["object", "null"])
  // This preserves nullable information when using direct $ref with types array
  if (
    isObject(currentSchema) &&
    'type' in schema &&
    Array.isArray(schema.type)
  ) {
    const type = schema.type as string[];
    const currentSchemaObject = currentSchema as Record<string, unknown>;
    currentSchema = {
      ...currentSchemaObject,
      type,
    } as OpenApiSchemaObject | OpenApiReferenceObject;
  }

  return {
    currentSchema: currentSchema as TSchema | undefined,
    refInfo,
  };
}

/* eslint-enable @typescript-eslint/no-unnecessary-type-parameters */

function encodeJsonPointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

/**
 * Build the dynamic scope for a schema: maps `$dynamicAnchor` names to concrete
 * type entries for self-referential resolution, `$defs` bindings, and sibling anchors.
 */
export function buildDynamicScope(
  schemaName: string,
  schema: OpenApiSchemaObject,
  context: ContextSpec,
): Record<string, DynamicScopeEntry> {
  const scope: Record<string, DynamicScopeEntry> = {};

  const getSchemaScopeEntry = (name: string): DynamicScopeEntry => {
    const refInfo = getRefInfo(
      `#/components/schemas/${encodeJsonPointerSegment(name)}`,
      context,
    );

    return {
      name: refInfo.name,
      schemaName: refInfo.originalName,
    };
  };

  const schemaRecord = schema as Record<string, unknown>;

  if (typeof schemaRecord.$dynamicAnchor === 'string') {
    scope[schemaRecord.$dynamicAnchor] = getSchemaScopeEntry(schemaName);
  }

  const defs = schemaRecord.$defs as
    | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
    | undefined;
  if (defs && typeof defs === 'object') {
    const unboundAnchors: string[] = [];
    for (const [, defSchema] of Object.entries(defs)) {
      if (!defSchema || typeof defSchema !== 'object') continue;
      const defRecord = defSchema as Record<string, unknown>;
      if (typeof defRecord.$dynamicAnchor === 'string') {
        const anchorName = defRecord.$dynamicAnchor;
        const refInDef = (defSchema as OpenApiReferenceObject).$ref;
        if (refInDef?.startsWith('#/components/schemas/')) {
          const { name, originalName } = getRefInfo(refInDef, context);
          scope[anchorName] = { name, schemaName: originalName };
        } else if (!refInDef) {
          unboundAnchors.push(anchorName);
        }
      }
    }
    if (unboundAnchors.length > 0) {
      const uniqueNames = dynamicAnchorsToUniqueParamNames(unboundAnchors);
      for (const anchor of unboundAnchors) {
        const paramName = uniqueNames.get(anchor);
        if (paramName === undefined) continue;
        scope[anchor] = {
          name: paramName,
          schemaName: paramName,
          isParameter: true,
        };
      }
    }
  }

  return scope;
}

/**
 * Build dynamic scope entries for an **anonymous inline** subschema that declares
 * `$dynamicAnchor` without a `$ref` (e.g. inside `allOf`, `items`, nested props).
 *
 * Unlike {@link buildDynamicScope}, entries carry the concrete `inlineSchema` so
 * that a descendant `$dynamicRef` resolves to the inline override rather than the
 * outer/global component. Used when `dereference` enters a subschema without a
 * named component `$ref`.
 *
 * Scope of handling (deliberate, see #3492):
 *   - Direct `$dynamicAnchor` on the subschema → inline entry.
 *   - `$defs` `$dynamicAnchor` *without* a `$ref` → inline entry. Note this
 *     differs from `buildDynamicScope`, which treats unbound `$defs` anchors as
 *     generic parameters (`isParameter`); inline subschemas are concrete
 *     instances, so the anchor resolves to the inline schema object itself.
 *   - `$defs` `$dynamicAnchor` *with* a `$ref` → intentionally NOT collected
 *     here. Such anchors rely on `resolveDynamicRef`'s global fallback (which
 *     finds them when the `$ref` target declares the same anchor). Fully
 *     resolving them would duplicate `buildDynamicScope`'s `$defs` logic.
 */
export function buildInlineDynamicScope(
  schema: OpenApiSchemaObject,
): Record<string, DynamicScopeEntry> {
  const scope: Record<string, DynamicScopeEntry> = {};
  const schemaRecord = schema as Record<string, unknown>;

  if (typeof schemaRecord.$dynamicAnchor === 'string') {
    const anchor = schemaRecord.$dynamicAnchor;
    scope[anchor] = {
      name: anchor,
      schemaName: anchor,
      inlineSchema: schema,
    };
  }

  const defs = schemaRecord.$defs as
    | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
    | undefined;
  if (defs && typeof defs === 'object') {
    for (const defSchema of Object.values(defs)) {
      if (!defSchema || typeof defSchema !== 'object') continue;
      const defRecord = defSchema as Record<string, unknown>;
      if (
        typeof defRecord.$dynamicAnchor === 'string' &&
        !(defSchema as OpenApiReferenceObject).$ref
      ) {
        const anchor = defRecord.$dynamicAnchor;
        scope[anchor] = {
          name: anchor,
          schemaName: anchor,
          inlineSchema: defSchema as OpenApiSchemaObject,
        };
      }
    }
  }

  return scope;
}

/**
 * Resolve a `$dynamicRef` anchor to its concrete type using the current dynamic scope.
 * Returns `{ schema: {}, resolvedTypeName: 'unknown' }` when no scope override exists.
 */
export function resolveDynamicRef(
  anchorName: string,
  context: ContextSpec,
  imports: GeneratorImport[] = [],
): {
  schema: OpenApiSchemaObject;
  imports: GeneratorImport[];
  resolvedTypeName: string;
  schemaName: string | undefined;
} {
  const scope = context.dynamicScope ?? {};
  let scopeEntry = scope[anchorName];

  if (!scopeEntry) {
    const schemas = (
      (context.spec as Record<string, unknown>).components as
        | Record<string, unknown>
        | undefined
    )?.schemas as Record<string, unknown> | undefined;

    if (schemas && typeof schemas === 'object') {
      const matches: string[] = [];
      for (const [schemaName, schemaObj] of Object.entries(schemas)) {
        if (!schemaObj || typeof schemaObj !== 'object') continue;
        const rec = schemaObj as Record<string, unknown>;
        if (rec.$dynamicAnchor === anchorName) {
          matches.push(schemaName);
        }
      }
      const match =
        matches.length === 1
          ? matches[0]
          : matches.find((m) => m === anchorName);
      if (match) {
        const refInfo = getRefInfo(
          `#/components/schemas/${encodeJsonPointerSegment(match)}`,
          context,
        );
        scopeEntry = {
          name: refInfo.name,
          schemaName: refInfo.originalName,
        };
      }
    }
  }

  if (!scopeEntry) {
    return {
      schema: {},
      imports,
      resolvedTypeName: 'unknown',
      schemaName: undefined,
    };
  }

  if (scopeEntry.isParameter) {
    return {
      schema: {},
      imports,
      resolvedTypeName: scopeEntry.name,
      schemaName: undefined,
    };
  }

  if (scopeEntry.inlineSchema) {
    return {
      schema: scopeEntry.inlineSchema,
      imports,
      resolvedTypeName: scopeEntry.name,
      schemaName: undefined,
    };
  }

  const resolvedTypeName = scopeEntry.name;
  const schemaRef = `#/components/schemas/${encodeJsonPointerSegment(scopeEntry.schemaName)}`;

  try {
    const { schema: resolvedSchema, imports: resolvedImports } =
      resolveRef<OpenApiSchemaObject>({ $ref: schemaRef }, context, imports);
    return {
      schema: resolvedSchema,
      imports: resolvedImports,
      resolvedTypeName,
      schemaName: scopeEntry.schemaName,
    };
  } catch {
    return {
      schema: {},
      imports,
      resolvedTypeName: 'unknown',
      schemaName: undefined,
    };
  }
}

/** Recursively resolves `$ref` entries in an examples array or record. */
export function resolveExampleRefs(
  examples: Examples,
  context: ContextSpec,
): ResolvedExample[] | Record<string, ResolvedExample> | undefined {
  if (!examples) {
    return undefined;
  }
  return Array.isArray(examples)
    ? examples.map((example) => {
        if (isObject(example) && isReference(example)) {
          const { schema }: { schema: OpenApiExampleObject } = resolveRef(
            example,
            context,
          );
          // Bridge assertion: ExampleObject.value is typed as `any`
          return schema.value as ResolvedExample;
        }
        return example;
      })
    : (() => {
        const result: Record<string, ResolvedExample> = {};
        for (const [key, example] of Object.entries(examples)) {
          // Bridge assertion: ExampleObject.value is typed as `any`
          result[key] =
            isObject(example) && isReference(example)
              ? ((
                  resolveRef(example, context) as {
                    schema: OpenApiExampleObject;
                  }
                ).schema.value as ResolvedExample)
              : example;
        }
        return result;
      })();
}
