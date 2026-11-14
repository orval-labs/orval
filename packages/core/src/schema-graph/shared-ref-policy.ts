import type { ContextSpec } from '../types';
import {
  carriesSiblings,
  type ComponentFacts,
  getComponentFacts,
  needsRequiredKeys,
  reachesDirection,
  type RefPolicy,
  type RefSite,
  type SchemaDirection,
} from './ref-policy';
import { getComponentKey, getComponentSchema } from './refs';
import { getUnguardedCycleKeys } from './unguarded-cycles';

/**
 * A policy that keeps a ref where inlining it would not change what it
 * validates, on the rules every library shares. `inlines` adds the library's
 * own reasons to inline.
 */
export const createSharedRefPolicy = (
  context: ContextSpec,
  direction: SchemaDirection | undefined,
  inlines: (ref: string, site: RefSite, facts: ComponentFacts) => boolean,
): RefPolicy => {
  const inCycle = getUnguardedCycleKeys(context);
  return (ref, site) => {
    const schema = getComponentSchema(ref, context);
    if (schema === undefined) return false;
    // Inlining reads the cycle like the flag off does, where the reference that
    // closes it is validated as unknown.
    if (inCycle.has(getComponentKey(ref) ?? '')) return false;
    if (site.inUncheckedAllOf) return false;
    // Inlining drops the siblings an alias puts on its target, which its own
    // constant applies.
    if (carriesSiblings(schema)) return false;
    const facts = getComponentFacts(ref, schema, context);
    // The default fills a missing value only where the schema itself is
    // generated, so a reference cannot stand in for it.
    if (facts.hasDefault()) return false;
    // A schema that checks nothing is cheaper inline, and the containers
    // around it recognise it only when it is.
    if (facts.checksNothing()) return false;
    if (direction && reachesDirection(ref, context, direction)) return false;
    return (
      !needsRequiredKeys(facts, site.requiredKeys) && !inlines(ref, site, facts)
    );
  };
};
