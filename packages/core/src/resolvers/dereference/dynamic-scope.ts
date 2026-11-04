import { getDynamicAnchorName } from '../../getters/ref';
import type { ContextSpec, OpenApiNonBooleanSchemaObject } from '../../types';
import { isObject, omitBy } from '../../utils';
import {
  COMPONENT_SCHEMAS_PREFIX,
  buildDynamicScope,
  buildInlineDynamicScope,
  encodeJsonPointerSegment,
  resolveDynamicRef,
} from '../ref';

function extractSchemaNameFromRef($ref: string): string | undefined {
  if (!$ref.startsWith(COMPONENT_SCHEMAS_PREFIX)) return undefined;
  const raw = $ref.slice(COMPONENT_SCHEMAS_PREFIX.length);
  return decodeURIComponent(raw.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function hasDynamicAnchors(schema: Record<string, unknown>): boolean {
  if (typeof schema.$dynamicAnchor === 'string') return true;
  const defs = schema.$defs;
  return (
    typeof defs === 'object' &&
    defs !== null &&
    Object.values(defs).some(
      (def) =>
        typeof def === 'object' && def !== null && '$dynamicAnchor' in def,
    )
  );
}

/**
 * Attaches the dynamic scope a schema declares to the context. Returns the
 * given context itself when the schema declares no anchors.
 */
export function buildScopedContext(
  childContext: ContextSpec,
  refName: string | undefined,
  resolvedSchema: OpenApiNonBooleanSchemaObject,
): ContextSpec {
  if (refName) {
    const schemaName = extractSchemaNameFromRef(refName);
    if (!schemaName) return childContext;
    if (!hasDynamicAnchors(resolvedSchema)) return childContext;

    return {
      ...childContext,
      dynamicScope: buildDynamicScope(schemaName, resolvedSchema, childContext),
    };
  }

  // Anonymous inline subschema (reached via allOf/items/nested props without a
  // $ref). Detect inline $dynamicAnchor / $defs anchors and merge them over the
  // existing scope so the inline override shadows the parent anchor while
  // non-overridden parent anchors remain reachable. See #3492.
  const inlineScope = buildInlineDynamicScope(resolvedSchema);
  if (Object.keys(inlineScope).length === 0) return childContext;

  return {
    ...childContext,
    dynamicScope: { ...childContext.dynamicScope, ...inlineScope },
  };
}

/** What a `$dynamicRef` expands to: an empty schema, or a schema still to be walked. */
export type DynamicRefPlan =
  | { kind: 'empty' }
  | {
      kind: 'expand';
      schema: OpenApiNonBooleanSchemaObject;
      context: ContextSpec;
    };

const EMPTY_PLAN: DynamicRefPlan = { kind: 'empty' };

/**
 * Resolves the target of a `$dynamicRef` through the dynamic scope, falling
 * back to a scan of `components.schemas` for a matching `$dynamicAnchor`.
 * Unresolved, external, generic-parameter and circular refs plan to `{}`.
 */
export function planDynamicRef(
  schema: object & { $dynamicRef: string },
  context: ContextSpec,
): DynamicRefPlan {
  const dynamicRef = schema.$dynamicRef;
  const anchorName = getDynamicAnchorName(dynamicRef);
  if (!anchorName) return EMPTY_PLAN;

  const {
    resolvedTypeName,
    schema: resolvedSchema,
    schemaName,
  } = resolveDynamicRef(anchorName, context);

  // Cycle key. Inline overrides resolve with `schemaName: undefined`, so every
  // resolution of the same anchor collapses to `@?`. This is correct for a
  // self-referential inline override. A false positive is possible only in the
  // contrived shape where an inline override A (reached via `$dynamicRef`) itself
  // contains a *distinct* nested inline override B of the same anchor with a
  // `$dynamicRef` descendant — B's resolution inherits A's key from `parents`
  // and returns `{}` instead of B. Siblings don't leak (each `dereference` uses
  // an immutable parent context), only this nested-via-`$dynamicRef` shape.
  // Acceptable given how exotic it is. See #3492.
  const dynamicRefPath = `$dynamicRef:${dynamicRef}@${schemaName ?? '?'}`;
  if (context.parents?.includes(dynamicRefPath)) return EMPTY_PLAN;

  if (resolvedTypeName === 'unknown' || !isObject(resolvedSchema)) {
    return EMPTY_PLAN;
  }

  const childContext: ContextSpec = {
    ...context,
    parents: [...(context.parents ?? []), dynamicRefPath],
  };

  const scopedContext = buildScopedContext(
    childContext,
    schemaName
      ? `${COMPONENT_SCHEMAS_PREFIX}${encodeJsonPointerSegment(schemaName)}`
      : undefined,
    resolvedSchema,
  );

  const siblings = omitBy(schema, (_, key) => key === '$dynamicRef');

  return {
    kind: 'expand',
    schema: { ...resolvedSchema, ...siblings },
    context: scopedContext,
  };
}
