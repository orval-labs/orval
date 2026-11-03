import { getDynamicAnchorName } from '../../getters/ref';
import type { ContextSpec, OpenApiNonBooleanSchemaObject } from '../../types';
import { isObject } from '../../utils';
import {
  buildDynamicScope,
  buildInlineDynamicScope,
  resolveDynamicRef,
} from '../ref';

const COMPONENT_SCHEMAS_PREFIX = '#/components/schemas/';

function extractSchemaNameFromRef($ref: string): string | undefined {
  if (!$ref.startsWith(COMPONENT_SCHEMAS_PREFIX)) return undefined;
  const raw = $ref.slice(COMPONENT_SCHEMAS_PREFIX.length);
  return decodeURIComponent(raw.replaceAll('~1', '/').replaceAll('~0', '~'));
}

function encodeSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function hasDynamicAnchors(schema: Record<string, unknown>): boolean {
  if (typeof schema.$dynamicAnchor === 'string') return true;
  const defs = schema.$defs;
  return (
    isObject(defs) &&
    Object.values(defs).some((def) => isObject(def) && '$dynamicAnchor' in def)
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

  // Anonymous inline subschema: inline anchors shadow the parent scope while
  // non-overridden parent anchors stay reachable.
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

  // Inline overrides resolve with `schemaName: undefined`, so every resolution
  // of the same anchor collapses to `@?`. That is right for a self-referential
  // inline override; a false positive needs a distinct nested inline override
  // of the same anchor with a `$dynamicRef` descendant, which is too exotic to
  // justify a finer key.
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
      ? `${COMPONENT_SCHEMAS_PREFIX}${encodeSegment(schemaName)}`
      : undefined,
    resolvedSchema,
  );

  const siblings = Object.fromEntries(
    Object.entries(schema).filter(([key]) => key !== '$dynamicRef'),
  );

  return {
    kind: 'expand',
    schema: { ...resolvedSchema, ...siblings },
    context: scopedContext,
  };
}
