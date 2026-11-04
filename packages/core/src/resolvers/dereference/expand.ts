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

// Merges the refs of all parts plus `ownRef` without copying more than once.
const unionRefs = (
  parts: readonly Expansion<unknown>[],
  ownRef?: string,
): ReadonlySet<string> => {
  let single: ReadonlySet<string> | undefined;
  let merged: Set<string> | undefined;
  for (const { refs } of parts) {
    if (refs.size === 0) continue;
    if (!single && !merged) {
      single = refs;
      continue;
    }
    merged ??= new Set(single);
    for (const part of refs) merged.add(part);
  }
  if (ownRef === undefined) return merged ?? single ?? NO_REFS;
  // `single` may be shared with a cached expansion, so it is copied first.
  merged ??= new Set(single);
  merged.add(ownRef);
  return merged;
};

// Own data property, so a `__proto__` key cannot change the prototype.
const setOwn = (target: object, key: string | number, value: unknown): void => {
  Object.defineProperty(target, key, {
    value,
    writable: true,
    enumerable: true,
    configurable: true,
  });
};

const isVerbatimKey = (key: string, options: DereferenceOptions): boolean =>
  ALWAYS_VERBATIM_KEYS.has(key) || (options.isVerbatimKey?.(key) ?? false);

const withoutKey = (
  record: Record<string, unknown>,
  omitted: string,
): Record<string, unknown> =>
  Object.fromEntries(Object.entries(record).filter(([key]) => key !== omitted));

const hasEmptyDynamicScope = (context: ContextSpec): boolean =>
  Object.keys(context.dynamicScope ?? {}).length === 0;

/** A nested schema still to be expanded, and where its expansion goes. */
interface Job {
  target: Record<string, unknown> | unknown[];
  key: string | number;
  schema: unknown;
}

/** A schema whose entries are being expanded; children run on the explicit stack. */
interface Frame {
  context: ContextSpec;
  options: DereferenceOptions;
  ownRef: string | undefined;
  result: Record<string, unknown>;
  jobs: Job[];
  next: number;
  parts: Expansion<unknown>[];
  scopeFree: boolean;
  /** Set for a bare `{ $ref }` whose expansion may be cached. */
  cacheable?: { ref: string; parents: readonly string[] };
}

// Splits a value into its final shape plus jobs for the nested schemas.
function planValue(
  value: unknown,
  target: Record<string, unknown> | unknown[],
  key: string | number,
  jobs: Job[],
): void {
  if (isObject(value)) {
    jobs.push({ target, key, schema: value });
    setOwn(target, key, undefined);
  } else if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (const [index, item] of (value as unknown[]).entries()) {
      planValue(item, items, index, jobs);
    }
    setOwn(target, key, items);
  } else {
    setOwn(target, key, value);
  }
}

/**
 * Starts expanding the entries of a schema. `ownRef` is the `$ref` the schema
 * was reached through; it is added to the met refs.
 */
function openFrame(
  schema: Record<string, unknown>,
  context: ContextSpec,
  options: DereferenceOptions,
  ownRef: string | undefined,
  scopeFree: boolean,
): Frame {
  const result: Record<string, unknown> = {};
  const jobs: Job[] = [];

  for (const key of Object.keys(schema)) {
    const value = schema[key];
    if (key === 'properties' && isObject(value)) {
      const properties: Record<string, unknown> = {};
      for (const name of Object.keys(value)) {
        const property = value[name];
        if (options.keepBooleanProperties && isBoolean(property)) {
          setOwn(properties, name, property);
        } else {
          setOwn(properties, name, undefined);
          jobs.push({ target: properties, key: name, schema: property });
        }
      }
      setOwn(result, key, properties);
    } else if (isVerbatimKey(key, options)) {
      setOwn(result, key, value);
    } else {
      planValue(value, result, key, jobs);
    }
  }

  return {
    context,
    options,
    ownRef,
    result,
    jobs,
    next: 0,
    parts: [],
    scopeFree,
  };
}

function closeFrame(frame: Frame): Expansion {
  let scopeFree = frame.scopeFree;
  for (const part of frame.parts) {
    if (!part.scopeFree) scopeFree = false;
  }

  // The entries are rebuilt from a JSON document, so the compiler cannot see
  // that the result is still a schema.
  const expansion: Expansion = {
    value: frame.result as OpenApiNonBooleanSchemaObject,
    refs: unionRefs(frame.parts, frame.ownRef),
    scopeFree,
  };
  const { cacheable } = frame;
  if (!cacheable || !scopeFree) return expansion;

  storeExpansion(frame.context.spec, frame.options, cacheable.ref, {
    value: expansion.value,
    refs: expansion.refs,
    cutByAncestors: ancestorsAmong(expansion.refs, cacheable.parents),
  });
  return { ...expansion, value: { ...expansion.value } };
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

const isBareRef = (schema: Record<string, unknown>): boolean =>
  Object.keys(schema).length === 1;

const canReuseExpansions = (
  context: ContextSpec,
  options: DereferenceOptions,
): boolean => !options.dynamicRefs || hasEmptyDynamicScope(context);

/**
 * Expands a schema that needs no nested work (a leaf, a cut or cached ref, an
 * unresolved target) or opens a frame for the entries of one that does.
 */
function begin(
  schema: unknown,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion | Frame {
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
    return beginDynamicRef(schema, context, options, undefined);
  }

  // A bare `{ $ref }` reuses a cached expansion when the ancestors cut the
  // same refs it met. Every result is a fresh top-level object.
  const bare =
    ref !== undefined &&
    isBareRef(schema) &&
    canReuseExpansions(context, options);
  const parents = context.parents ?? [];
  if (bare) {
    const cached = findExpansion(context.spec, options, ref, parents);
    if (cached) {
      return { value: { ...cached.value }, refs: cached.refs, scopeFree: true };
    }
  }

  let resolved = schema;
  let childContext = context;
  if (ref !== undefined) {
    const merged = mergeWithTarget(schema, ref, context, options);
    if (!merged) return emptyFor(ref);
    resolved = merged;
    childContext = { ...context, parents: [...parents, ref] };
  }

  let frame: Frame;
  if (options.dynamicRefs) {
    const scopedContext = buildScopedContext(
      childContext,
      ref,
      resolved as OpenApiNonBooleanSchemaObject,
    );
    if (isDynamicReference(resolved)) {
      return beginDynamicRef(resolved, scopedContext, options, ref);
    }
    // A freshly attached dynamic scope can change what nested refs resolve to.
    frame = openFrame(
      resolved,
      scopedContext,
      options,
      ref,
      scopedContext === childContext,
    );
  } else {
    frame = openFrame(resolved, childContext, options, ref, true);
  }
  if (bare) frame.cacheable = { ref, parents };
  return frame;
}

function beginDynamicRef(
  schema: object & { $dynamicRef: string },
  context: ContextSpec,
  options: DereferenceOptions,
  ownRef: string | undefined,
): Expansion | Frame {
  const plan = planDynamicRef(schema, context);
  // Dynamic resolution depends on the scope, so it is never reused.
  if (plan.kind === 'empty') {
    return {
      value: {},
      refs: ownRef === undefined ? NO_REFS : new Set([ownRef]),
      scopeFree: false,
    };
  }
  return openFrame(plan.schema, plan.context, options, ownRef, false);
}

// Runs on an explicit stack, so the nesting depth of a document is not
// limited by the call stack.
export function expandSchema(
  schema: unknown,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion {
  const root = begin(schema, context, options);
  if (!('jobs' in root)) return root;

  const stack: Frame[] = [root];
  for (;;) {
    // The stack is never empty inside the loop: the root returns directly.
    const frame = stack[stack.length - 1] as Frame;
    if (frame.next < frame.jobs.length) {
      const job = frame.jobs[frame.next++];
      const started = begin(job.schema, frame.context, options);
      if ('jobs' in started) {
        stack.push(started);
      } else {
        frame.parts.push(started);
        setOwn(job.target, job.key, started.value);
      }
      continue;
    }

    const done = closeFrame(frame);
    stack.pop();
    const parent = stack.at(-1);
    if (!parent) return done;
    const job = parent.jobs[parent.next - 1];
    parent.parts.push(done);
    setOwn(job.target, job.key, done.value);
  }
}
