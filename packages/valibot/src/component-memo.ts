import { type ContextSpec, isObject } from '@orval/core';

import { getRef } from './refs';

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
export const memoizeByRef = (
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

/** The ref of a schema that is nothing but a `$ref` not yet followed. */
export const bareRef = (
  schema: unknown,
  followed: ReadonlySet<string>,
): string | undefined => {
  const ref = getRef(schema);
  return ref !== undefined &&
    isObject(schema) &&
    Object.keys(schema).length === 1 &&
    !followed.has(ref)
    ? ref
    : undefined;
};
