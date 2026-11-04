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
import {
  createExpansionCache,
  findExpansion,
  getExpansionCache,
  NO_REFS,
  singleRef,
  storeExpansion,
  unionRefs,
} from './cache';
import type { ExpansionCache } from './cache';
import { buildScopedContext, planDynamicRef } from './dynamic-scope';
import { tryResolveRefSchema } from './resolve-target';
import type { DereferenceOptions, Expansion } from './types';

const ALWAYS_VERBATIM_KEYS = new Set(['default', 'example', 'examples']);

const leaf = <TValue>(value: TValue): Expansion<TValue> => ({
  value,
  refs: NO_REFS,
  reusable: true,
});

// A cut or unresolved ref still counts as met: whether it is cut decides the value.
const emptyFor = (ref: string, run: Run, wantsRefs: boolean): Expansion => ({
  value: {},
  refs: wantsRefs ? singleRef(run.cache, ref) : NO_REFS,
  reusable: true,
});

/**
 * Tracking met refs costs bitset words read and written. It is given up once
 * that exceeds `base` plus `perVisit` per schema visited plus `perWord` per
 * schema visited and bitset word of the document, so it stays proportional to
 * the expansion itself however many refs the document has. Lookups of cached
 * results go on.
 */
export interface TrackingBudget {
  base: number;
  perVisit: number;
  perWord: number;
}

const DEFAULT_BUDGET: TrackingBudget = {
  base: 100_000,
  perVisit: 16,
  perWord: 1,
};

/** State shared by every schema expanded in one `expandSchema` call. */
interface Run {
  cache: ExpansionCache;
  /** False once the budget is spent: refs are no longer collected or stored. */
  tracking: boolean;
  budget: TrackingBudget;
  /** Bitset words read and written so far. */
  copied: number;
  /** Schemas begun so far, the measure of work the budget is relative to. */
  visits: number;
}

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
  run: Run;
  ownRef: string | undefined;
  /** Whether an enclosing frame stores its result, so the met refs are needed. */
  wantsRefs: boolean;
  result: Record<string, unknown>;
  jobs: Job[];
  next: number;
  parts: Expansion<unknown>[];
  reusable: boolean;
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
  run: Run,
  ownRef: string | undefined,
  reusable: boolean,
  wantsRefs: boolean,
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
    run,
    ownRef,
    wantsRefs,
    result,
    jobs,
    next: 0,
    parts: [],
    reusable,
    cacheable,
  };
}

function closeFrame(frame: Frame): Expansion {
  const { run } = frame;
  let reusable = frame.reusable && run.tracking;
  for (const part of frame.parts) {
    if (!part.reusable) reusable = false;
  }

  let refs = NO_REFS;
  if (reusable && frame.wantsRefs) {
    refs = unionRefs(run.cache, frame.parts, frame.ownRef, run);
    const { base, perVisit, perWord } = run.budget;
    const width = (run.cache.ids.size >>> 5) + 1;
    if (run.copied > base + run.visits * (perVisit + perWord * width)) {
      run.tracking = false;
      reusable = false;
    }
  }

  // The entries are rebuilt from a JSON document, so the compiler cannot see
  // that the result is still a schema.
  const expansion: Expansion = {
    value: frame.result as OpenApiNonBooleanSchemaObject,
    refs,
    reusable,
  };
  const { cacheable } = frame;
  if (!cacheable || !reusable) return expansion;

  storeExpansion(
    run.cache,
    cacheable.ref,
    expansion.value,
    expansion.refs,
    cacheable.parents,
  );
  return { ...expansion, value: { ...expansion.value } };
}

/** Merges a `$ref` node with its target; `undefined` when the target is missing or of a type that cannot be merged. */
function mergeWithTarget(
  schema: Record<string, unknown>,
  ref: string,
  context: ContextSpec,
  options: DereferenceOptions,
): Record<string, unknown> | undefined {
  const target = tryResolveRefSchema(ref, context, options.onResolveError);

  if (options.falseTargetIsUnresolved && target === false) return;
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
  run: Run,
  wantsRefs: boolean,
): Started {
  run.visits++;
  // Once tracking stops, nothing reads the met refs any more.
  wantsRefs &&= run.tracking;
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
    return done(emptyFor(ref, run, wantsRefs));
  }

  if (options.dynamicRefs && isDynamicReference(schema)) {
    return beginDynamicRef(schema, context, options, run, undefined, wantsRefs);
  }

  // A bare `{ $ref }` reuses a cached expansion when the ancestors cut the
  // same refs it met. Every result is a fresh top-level object.
  const bare =
    ref !== undefined &&
    isBareRef(schema) &&
    canReuseExpansions(context, options);
  const parents = context.parents ?? [];
  if (bare) {
    const cached = findExpansion(run.cache, ref, parents);
    if (cached) {
      return done({
        value: { ...cached.value },
        refs: cached.refs,
        reusable: true,
      });
    }
  }

  let resolved = schema;
  let childContext = context;
  if (ref !== undefined) {
    const merged = mergeWithTarget(schema, ref, context, options);
    if (!merged) return done(emptyFor(ref, run, wantsRefs));
    resolved = merged;
    childContext = { ...context, parents: [...parents, ref] };
  }

  const cacheable = bare && run.tracking ? { ref, parents } : undefined;
  const framesWantRefs = wantsRefs || cacheable !== undefined;
  if (!options.dynamicRefs) {
    return {
      kind: 'frame',
      frame: openFrame(
        resolved,
        childContext,
        options,
        run,
        ref,
        true,
        framesWantRefs,
        cacheable,
      ),
    };
  }

  const scopedContext = buildScopedContext(
    childContext,
    ref,
    resolved as OpenApiNonBooleanSchemaObject,
  );
  if (isDynamicReference(resolved)) {
    return beginDynamicRef(
      resolved,
      scopedContext,
      options,
      run,
      ref,
      framesWantRefs,
    );
  }
  // A freshly attached dynamic scope can change what nested refs resolve to.
  return {
    kind: 'frame',
    frame: openFrame(
      resolved,
      scopedContext,
      options,
      run,
      ref,
      scopedContext === childContext,
      framesWantRefs,
      cacheable,
    ),
  };
}

function beginDynamicRef(
  schema: object & { $dynamicRef: string },
  context: ContextSpec,
  options: DereferenceOptions,
  run: Run,
  ownRef: string | undefined,
  wantsRefs: boolean,
): Started {
  const plan = planDynamicRef(schema, context);
  // Dynamic resolution depends on the scope, so it is never reused.
  if (plan.kind === 'empty') {
    return done({
      value: {},
      refs:
        ownRef !== undefined && wantsRefs
          ? singleRef(run.cache, ownRef)
          : NO_REFS,
      reusable: false,
    });
  }
  return {
    kind: 'frame',
    frame: openFrame(
      plan.schema,
      plan.context,
      options,
      run,
      ownRef,
      false,
      wantsRefs,
    ),
  };
}

// Runs on an explicit stack, so the nesting depth of a document is not
// limited by the call stack.
export function expandSchema(
  schema: unknown,
  context: ContextSpec,
  options: DereferenceOptions,
  budget: TrackingBudget = DEFAULT_BUDGET,
): Expansion {
  const run: Run = {
    cache: isObject(context.spec)
      ? getExpansionCache(context.spec, options)
      : createExpansionCache(),
    tracking: true,
    budget,
    copied: 0,
    visits: 0,
  };
  const root = begin(schema, context, options, run, false);
  if (root.kind === 'done') return root.expansion;

  const stack: Frame[] = [root.frame];
  for (;;) {
    // The stack is never empty inside the loop: the root returns directly.
    const frame = stack[stack.length - 1] as Frame;
    if (frame.next < frame.jobs.length) {
      const job = frame.jobs[frame.next++];
      const started = begin(
        job.schema,
        frame.context,
        options,
        run,
        frame.wantsRefs,
      );
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
