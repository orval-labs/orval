import type { ContextSpec, OpenApiReferenceObject } from '../types';
import { isObject } from '../utils/assertion';
import { getRef } from './refs';
import { hasOnlyAnnotations } from './schema-keys';

interface MemoState {
  results: Map<string, ReadonlySet<string>>;
  inProgress: Set<string>;
  // Results cut short by a cycle, good for the computation running now only.
  provisional: Map<string, ReadonlySet<string>>;
  cycleHits: number;
}

// Results that depend only on a component, kept per spec.
const states = new WeakMap<object, MemoState>();

const stateOf = (context: ContextSpec): MemoState => {
  const existing = states.get(context.spec);
  if (existing) return existing;
  const created: MemoState = {
    results: new Map(),
    inProgress: new Set(),
    provisional: new Map(),
    cycleHits: 0,
  };
  states.set(context.spec, created);
  return created;
};

/**
 * Computes a set of keys once per spec and key. A result cut short by a cycle
 * is reused only until the outermost computation ends, whose result is kept.
 */
const memoizeByRef = (
  context: ContextSpec,
  key: string,
  compute: () => ReadonlySet<string>,
): ReadonlySet<string> => {
  const state = stateOf(context);
  const cached = state.results.get(key);
  if (cached) return cached;
  const partial = state.provisional.get(key);
  if (partial) {
    // Whoever reads a cut result is cut short too.
    state.cycleHits++;
    return partial;
  }
  if (state.inProgress.has(key)) {
    state.cycleHits++;
    return new Set();
  }
  const hitsBefore = state.cycleHits;
  state.inProgress.add(key);
  try {
    const computed = compute();
    const outermost = state.inProgress.size === 1;
    if (state.cycleHits === hitsBefore || outermost) {
      state.results.set(key, computed);
    } else {
      state.provisional.set(key, computed);
    }
    return computed;
  } finally {
    state.inProgress.delete(key);
    if (state.inProgress.size === 0) state.provisional.clear();
  }
};

// The ref of a schema that is a `$ref` and annotations only, not yet followed.
// Annotations leave the keys of the target as they are; any other sibling
// would replace some, so such a schema is walked afresh.
const plainRef = (
  schema: unknown,
  followed: ReadonlySet<string>,
): string | undefined => {
  const ref = getRef(schema);
  return ref !== undefined &&
    isObject(schema) &&
    hasOnlyAnnotations(schema) &&
    !followed.has(ref)
    ? ref
    : undefined;
};

/**
 * The keys of a schema that is a plain `$ref`, taken from the memo of its
 * target. `compute` reads the keys of the bare ref from scratch. Undefined
 * when the schema is anything else, which the caller walks itself.
 */
const memoizedKeysOfRef = (
  context: ContextSpec,
  name: string,
  input: unknown,
  followed: ReadonlySet<string>,
  compute: (bare: OpenApiReferenceObject) => ReadonlySet<string>,
): ReadonlySet<string> | undefined => {
  const ref = plainRef(input, followed);
  // The keys are a union, so a closure started afresh adds the same ones.
  return ref === undefined
    ? undefined
    : memoizeByRef(context, `${name}:${ref}`, () => compute({ $ref: ref }));
};

/**
 * As `memoizedKeysOfRef`, for a closure that is listed rather than a set.
 * `compute` is called with memoization off, so it reads the target afresh.
 */
export const memoizedKeyListOfRef = (
  context: ContextSpec,
  name: string,
  input: unknown,
  followed: ReadonlySet<string>,
  compute: (bare: OpenApiReferenceObject) => readonly string[],
): string[] | undefined => {
  const keys = memoizedKeysOfRef(
    context,
    name,
    input,
    followed,
    (bare) => new Set(compute(bare)),
  );
  return keys && [...keys];
};
