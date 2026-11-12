import type { ContextSpec } from '../types';
import { isObject } from '../utils/assertion';
import {
  type DependencyGraph,
  nodesOnCycles,
} from '../utils/strongly-connected';
import { getComponentKey, getLocalRefTarget, getRef } from './refs';
import { compositionMembers } from './schema-keys';

// The components a schema reads without descending into a property, item or
// value. Local refs that are not whole components are followed as well.
const unguardedTargets = (
  schema: unknown,
  context: ContextSpec,
  seen: Set<string> = new Set(),
): string[] => {
  if (!isObject(schema)) return [];
  const ref = getRef(schema);
  const viaRef = (() => {
    if (ref === undefined) return [];
    const key = getComponentKey(ref);
    if (key !== undefined) return [key];
    if (seen.has(ref)) return [];
    seen.add(ref);
    return unguardedTargets(getLocalRefTarget(ref, context), context, seen);
  })();
  return [
    ...viaRef,
    ...compositionMembers(schema).flatMap((member) =>
      unguardedTargets(member, context, seen),
    ),
  ];
};

const buildGraph = (context: ContextSpec): DependencyGraph => {
  const schemas = context.spec.components?.schemas ?? {};
  return new Map(
    Object.entries(schemas).map(([key, schema]) => [
      key,
      new Set(
        unguardedTargets(schema, context).filter((target) =>
          Object.hasOwn(schemas, target),
        ),
      ),
    ]),
  );
};

const cache = new WeakMap<object, ReadonlySet<string>>();

/**
 * The components that read each other, without a property, item or value in
 * between. The policy inlines every reference to such a component, also from
 * outside the cycle: a constant that closed the cycle would have to drop the
 * constraints of its target.
 */
export const getUnguardedCycleKeys = (
  context: ContextSpec,
): ReadonlySet<string> => {
  const known = cache.get(context.spec);
  if (known) return known;
  const keys = nodesOnCycles(buildGraph(context));
  cache.set(context.spec, keys);
  return keys;
};
