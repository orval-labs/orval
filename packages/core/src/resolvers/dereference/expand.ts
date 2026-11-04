import type {
  ContextSpec,
  OpenApiNonBooleanSchemaObject,
  OpenApiSchemaObject,
} from '../../types';
import {
  isBoolean,
  isDynamicReference,
  isObject,
  isString,
  omitBy,
} from '../../utils';
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

// Plain assignment, except for `__proto__`: assigning it would swap the
// prototype of the result, so it is dropped or defined as an own property.
const setOwn = (
  target: object,
  key: string | number,
  value: unknown,
  options: DereferenceOptions,
): void => {
  if (key !== '__proto__') {
    (target as Record<string | number, unknown>)[key] = value;
  } else if (options.keepProtoKey) {
    Object.defineProperty(target, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  }
};

const isVerbatimKey = (key: string, options: DereferenceOptions): boolean =>
  ALWAYS_VERBATIM_KEYS.has(key) || (options.isVerbatimKey?.(key) ?? false);

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
  cacheable: { ref: string; parents: readonly string[] } | undefined;
}

/** The outcome of starting a schema: finished already, or a frame still to run. */
type Started =
  | { kind: 'done'; expansion: Expansion }
  | { kind: 'frame'; frame: Frame };

const done = (expansion: Expansion): Started => ({ kind: 'done', expansion });

// Splits a value into its final shape plus jobs for the nested schemas.
function planValue(
  value: unknown,
  target: Record<string, unknown> | unknown[],
  key: string | number,
  jobs: Job[],
  options: DereferenceOptions,
): void {
  if (isObject(value)) {
    jobs.push({ target, key, schema: value });
    setOwn(target, key, undefined, options);
  } else if (Array.isArray(value)) {
    const items: unknown[] = [];
    for (const [index, item] of (value as unknown[]).entries()) {
      planValue(item, items, index, jobs, options);
    }
    setOwn(target, key, items, options);
  } else {
    setOwn(target, key, value, options);
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
  cacheable?: Frame['cacheable'],
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
          setOwn(properties, name, property, options);
        } else {
          setOwn(properties, name, undefined, options);
          jobs.push({ target: properties, key: name, schema: property });
        }
      }
      setOwn(result, key, properties, options);
    } else if (isVerbatimKey(key, options)) {
      setOwn(result, key, value, options);
    } else {
      planValue(value, result, key, jobs, options);
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
    cacheable,
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
      ? { ...targetSchema, ...omitBy(schema, (_, key) => key === '$ref') }
      : targetSchema;
  }
  if (
    !isObject(target) &&
    !(options.mergeArrayTargets && Array.isArray(target))
  ) {
    options.onUnresolvedRef?.(ref);
    return;
  }
  return { ...target, ...omitBy(schema, (_, key) => key === '$ref') };
}

const isBareRef = (schema: Record<string, unknown>): boolean =>
  Object.keys(schema).length === 1;

const canReuseExpansions = (
  context: ContextSpec,
  options: DereferenceOptions,
): boolean =>
  // The cache is keyed by the document, so a context without one skips it.
  isObject(context.spec) &&
  (!options.dynamicRefs || hasEmptyDynamicScope(context));

/**
 * Expands a schema that needs no nested work (a leaf, a cut or cached ref, an
 * unresolved target) or opens a frame for the entries of one that does.
 */
function begin(
  schema: unknown,
  context: ContextSpec,
  options: DereferenceOptions,
): Started {
  // Not `typeof schema !== 'object'`: extensions such as JSON merge-patch
  // bodies carry `null` property values, which must pass through untouched.
  if (!isObject(schema)) {
    // Bridge: boolean and null schemas arrive here from untyped JSON.
    return done(leaf(toObjectSchema(schema as OpenApiSchemaObject)));
  }

  const ref =
    isString(schema.$ref) && !(options.ignoreEmptyRef && schema.$ref === '')
      ? schema.$ref
      : undefined;
  if (ref && context.parents?.includes(ref)) {
    options.onCircularRef?.(ref);
    return done(emptyFor(ref));
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
      return done({
        value: { ...cached.value },
        refs: cached.refs,
        scopeFree: true,
      });
    }
  }

  let resolved = schema;
  let childContext = context;
  if (ref !== undefined) {
    const merged = mergeWithTarget(schema, ref, context, options);
    if (!merged) return done(emptyFor(ref));
    resolved = merged;
    childContext = { ...context, parents: [...parents, ref] };
  }

  const cacheable = bare ? { ref, parents } : undefined;
  if (!options.dynamicRefs) {
    return {
      kind: 'frame',
      frame: openFrame(resolved, childContext, options, ref, true, cacheable),
    };
  }

  const scopedContext = buildScopedContext(
    childContext,
    ref,
    resolved as OpenApiNonBooleanSchemaObject,
  );
  if (isDynamicReference(resolved)) {
    return beginDynamicRef(resolved, scopedContext, options, ref);
  }
  // A freshly attached dynamic scope can change what nested refs resolve to.
  return {
    kind: 'frame',
    frame: openFrame(
      resolved,
      scopedContext,
      options,
      ref,
      scopedContext === childContext,
      cacheable,
    ),
  };
}

function beginDynamicRef(
  schema: object & { $dynamicRef: string },
  context: ContextSpec,
  options: DereferenceOptions,
  ownRef: string | undefined,
): Started {
  const plan = planDynamicRef(schema, context);
  // Dynamic resolution depends on the scope, so it is never reused.
  if (plan.kind === 'empty') {
    return done({
      value: {},
      refs: ownRef === undefined ? NO_REFS : new Set([ownRef]),
      scopeFree: false,
    });
  }
  return {
    kind: 'frame',
    frame: openFrame(plan.schema, plan.context, options, ownRef, false),
  };
}

// Runs on an explicit stack, so the nesting depth of a document is not
// limited by the call stack.
export function expandSchema(
  schema: unknown,
  context: ContextSpec,
  options: DereferenceOptions,
): Expansion {
  const root = begin(schema, context, options);
  if (root.kind === 'done') return root.expansion;

  const stack: Frame[] = [root.frame];
  for (;;) {
    // The stack is never empty inside the loop: the root returns directly.
    const frame = stack[stack.length - 1] as Frame;
    if (frame.next < frame.jobs.length) {
      const job = frame.jobs[frame.next++];
      const started = begin(job.schema, frame.context, options);
      if (started.kind === 'frame') {
        stack.push(started.frame);
      } else {
        frame.parts.push(started.expansion);
        setOwn(job.target, job.key, started.expansion.value, options);
      }
      continue;
    }

    const finished = closeFrame(frame);
    stack.pop();
    const parent = stack.at(-1);
    if (!parent) return finished;
    const job = parent.jobs[parent.next - 1];
    parent.parts.push(finished);
    setOwn(job.target, job.key, finished.value, options);
  }
}
