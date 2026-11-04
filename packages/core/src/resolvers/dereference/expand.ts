import type {
  ContextSpec,
  OpenApiNonBooleanSchemaObject,
  OpenApiSchemaObject,
} from '../../types';
import { isBoolean, isDynamicReference, isObject, isString } from '../../utils';
import { toObjectSchema } from '../../utils/object-schema';
import { ancestorsAmong, findExpansion, storeExpansion } from './cache';
import { buildScopedContext, planDynamicRef } from './dynamic-scope';
import { tryResolveRefSchema } from './resolve-target';
import type { DereferenceOptions, Expansion } from './types';

const ALWAYS_VERBATIM_KEYS = new Set(['default', 'example', 'examples']);

const NO_REFS: ReadonlySet<string> = new Set();

const leaf = <TValue>(value: TValue): Expansion<TValue> => ({
  value,
  refs: NO_REFS,
  scopeFree: true,
});

// A cut or unresolved ref still counts as met: whether it is cut decides the value.
const emptyFor = (ref: string): Expansion => ({
  value: {},
  refs: new Set([ref]),
  scopeFree: true,
});

const unionRefs = (
  expansions: readonly Expansion<unknown>[],
): ReadonlySet<string> => {
  const nonEmpty = expansions.filter(({ refs }) => refs.size > 0);
  if (nonEmpty.length === 0) return NO_REFS;
  if (nonEmpty.length === 1) return nonEmpty[0].refs;
  return new Set(nonEmpty.flatMap(({ refs }) => [...refs]));
};

const combine = <TValue>(
  value: TValue,
  parts: readonly Expansion<unknown>[],
): Expansion<TValue> => ({
  value,
  refs: unionRefs(parts),
  scopeFree: parts.every((part) => part.scopeFree),
});

const withRef = (expansion: Expansion, ref: string): Expansion => ({
  ...expansion,
  refs: new Set([...expansion.refs, ref]),
});

const isVerbatimKey = (key: string, options: DereferenceOptions): boolean =>
  ALWAYS_VERBATIM_KEYS.has(key) || (options.isVerbatimKey?.(key) ?? false);

const withoutKey = (
  record: Record<string, unknown>,
  omitted: string,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => key !== omitted));

const collectEntries = (
  entries: (readonly [string, Expansion<unknown>])[],
): Expansion<Record<string, unknown>> =>
  combine(
    Object.fromEntries(entries.map(([key, { value }]) => [key, value])),
    entries.map(([, expansion]) => expansion),
  );

const hasEmptyDynamicScope = (context: ContextSpec): boolean =>
  Object.keys(context.dynamicScope ?? {}).length === 0;

function expandValue(
  value: unknown,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion<unknown> {
  if (isObject(value)) return expandSchema(value, context, options);
  if (!Array.isArray(value)) return leaf(value);

  const items = value.map((item: unknown) =>
    expandValue(item, context, options),
  );
  return combine(
    items.map(({ value: itemValue }) => itemValue),
    items,
  );
}

function expandProperties(
  properties: Record<string, unknown>,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion<Record<string, unknown>> {
  return collectEntries(
    Object.entries(properties).map(([name, property]) => [
      name,
      options.keepBooleanProperties && isBoolean(property)
        ? leaf(property)
        : expandSchema(property, context, options),
    ]),
  );
}

function expandEntries(
  schema: Record<string, unknown>,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion {
  const expansion = collectEntries(
    Object.entries(schema).map(([key, value]) => {
      if (key === 'properties' && isObject(value)) {
        const properties = expandProperties(value, context, options);
        return [key, properties];
      }
      return [
        key,
        isVerbatimKey(key, options)
          ? leaf(value)
          : expandValue(value, context, options),
      ];
    }),
  );

  // The entries are rebuilt from a JSON document, so the compiler cannot see
  // that the result is still a schema.
  return {
    ...expansion,
    value: expansion.value as OpenApiNonBooleanSchemaObject,
  };
}

function expandDynamicRef(
  schema: object & { $dynamicRef: string },
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion {
  const plan = planDynamicRef(schema, context);
  // Dynamic resolution depends on the scope, so it is never reused.
  if (plan.kind === 'empty') return { ...leaf({}), scopeFree: false };
  return {
    ...expandEntries(plan.schema, plan.context, options),
    scopeFree: false,
  };
}

/** Merges a `$ref` node with its target; `undefined` when the target is not a schema. */
function mergeWithTarget(
  schema: Record<string, unknown>,
  ref: string,
  context: ContextSpec,
  options: DereferenceOptions,
): Record<string, unknown> | undefined {
  const target = tryResolveRefSchema(ref, context, options.onResolveError);

  if (isBoolean(target)) {
    const targetSchema = toObjectSchema(target);
    return options.keepSiblingsOfBooleanTarget
      ? { ...targetSchema, ...withoutKey(schema, '$ref') }
      : targetSchema;
  }
  if (!isObject(target)) {
    options.onUnresolvedRef?.(ref);
    return;
  }
  return { ...target, ...withoutKey(schema, '$ref') };
}

function expandNode(
  schema: Record<string, unknown>,
  ref: string | undefined,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion {
  if (ref === undefined) return expandResolved(schema, ref, context, options);

  const resolved = mergeWithTarget(schema, ref, context, options);
  if (!resolved) return emptyFor(ref);

  const childContext: ContextSpec = {
    ...context,
    parents: [...(context.parents ?? []), ref],
  };
  return withRef(expandResolved(resolved, ref, childContext, options), ref);
}

function expandResolved(
  resolved: Record<string, unknown>,
  ref: string | undefined,
  childContext: ContextSpec,
  options: DereferenceOptions,
): Expansion {
  if (!options.dynamicRefs) {
    return expandEntries(resolved, childContext, options);
  }

  const scopedContext = buildScopedContext(
    childContext,
    ref,
    resolved as OpenApiNonBooleanSchemaObject,
  );
  if (isDynamicReference(resolved)) {
    return expandDynamicRef(resolved, scopedContext, options);
  }

  const expansion = expandEntries(resolved, scopedContext, options);
  // A freshly attached dynamic scope can change what nested refs resolve to.
  return scopedContext === childContext
    ? expansion
    : { ...expansion, scopeFree: false };
}

/**
 * Expands a bare `{ $ref }`, reusing a cached expansion when the ancestors cut
 * the same refs it met. Returns a fresh top-level object.
 */
function expandBareRef(
  ref: string,
  schema: Record<string, unknown>,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion {
  const parents = context.parents ?? [];
  const cached = findExpansion(context.spec, options, ref, parents);
  if (cached) {
    return { value: { ...cached.value }, refs: cached.refs, scopeFree: true };
  }

  const expansion = expandNode(schema, ref, context, options);
  if (!expansion.scopeFree) return expansion;

  storeExpansion(context.spec, options, ref, {
    value: expansion.value,
    refs: expansion.refs,
    cutByAncestors: ancestorsAmong(expansion.refs, parents),
  });
  return { ...expansion, value: { ...expansion.value } };
}

const isBareRef = (schema: Record<string, unknown>): boolean =>
  Object.keys(schema).length === 1;

const canReuseExpansions = (
  context: ContextSpec,
  options: DereferenceOptions,
): boolean => !options.dynamicRefs || hasEmptyDynamicScope(context);

export function expandSchema(
  schema: unknown,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion {
  // Not `typeof schema !== 'object'`: extensions such as JSON merge-patch
  // bodies carry `null` property values, which must pass through untouched.
  if (!isObject(schema)) {
    // Bridge: boolean and null schemas arrive here from untyped JSON.
    return leaf(toObjectSchema(schema as OpenApiSchemaObject));
  }

  const ref = isString(schema.$ref) ? schema.$ref : undefined;
  if (ref && context.parents?.includes(ref)) {
    options.onCircularRef?.(ref);
    return emptyFor(ref);
  }

  if (options.dynamicRefs && isDynamicReference(schema)) {
    return expandDynamicRef(schema, context, options);
  }

  return ref !== undefined &&
    isBareRef(schema) &&
    canReuseExpansions(context, options)
    ? expandBareRef(ref, schema, context, options)
    : expandNode(schema, ref, context, options);
}
