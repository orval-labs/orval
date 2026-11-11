import {
  carriesSiblings,
  type ContextSpec,
  getComponentFacts,
  getComponentKey,
  getComponentSchema,
  getUnguardedCycleKeys,
  needsRequiredKeys,
  reachesDirection,
  type RefPolicy,
  requiresUndeclaredKey,
  type SchemaDirection,
} from '@orval/core';

import { isReusableSchemasEnabled } from './refs';

/** How the component constants are generated, whatever site reads them. */
export interface ComponentModes {
  strict: boolean;
  exactOptional: boolean;
}

/** Constants are shared, so they are strict only when every location is. */
export const getComponentModes = (context: ContextSpec): ComponentModes => {
  const { strict, exactOptional } = context.output.override.valibot;
  return {
    strict: Object.values(strict).every(Boolean),
    exactOptional,
  };
};

interface RefPolicyOptions {
  context: ContextSpec;
  // The properties a schema in this direction must not carry; refs to a
  // schema that holds some stay inline so they can be stripped.
  direction?: SchemaDirection;
  // The strictness and exactOptional of the site the schema is generated for.
  strict: boolean;
  exactOptional: boolean;
}

/** Which refs stay references. Undefined when reusable schemas are off. */
export const createRefPolicy = ({
  context,
  direction,
  strict,
  exactOptional,
}: RefPolicyOptions): RefPolicy | undefined => {
  if (!isReusableSchemasEnabled(context)) return undefined;
  const modes = getComponentModes(context);
  // A constant cannot follow a site that is generated differently.
  if (strict !== modes.strict || exactOptional !== modes.exactOptional) {
    return () => false;
  }
  const inCycle = getUnguardedCycleKeys(context);
  const policy: RefPolicy = (ref, site) => {
    const schema = getComponentSchema(ref, context);
    if (schema === undefined) return false;
    // Inlining reads the cycle like the flag off does, where the reference that
    // closes it is validated as unknown.
    if (inCycle.has(getComponentKey(ref) ?? '')) return false;
    const facts = getComponentFacts(ref, schema, context);
    // A strict object would reject the keys of the members it is merged with.
    if (strict && site.mergesMembers) return false;
    if (site.inUncheckedAllOf) return false;
    // Inlining drops the siblings an alias puts on its target, which its own
    // constant applies.
    if (carriesSiblings(schema)) return false;
    // The default fills a missing value only where the schema itself is
    // generated, so a reference cannot stand in for it.
    if (facts.hasDefault()) return false;
    // A transformed member would not merge with its siblings.
    if (site.inIntersection && facts.hasTransform()) {
      return false;
    }
    // A schema that checks nothing is cheaper inline, and the containers
    // around it recognise it only when it is.
    if (facts.checksNothing()) return false;
    // A required key nothing declares is dropped from an `allOf` member.
    if (site.inAllOf && requiresUndeclaredKey(facts)) return false;
    // The required keys reach a sibling through the schema's `required`,
    // which a reference hides.
    if (
      site.inAllOf &&
      facts.requiredKeys().some((key) => site.siblingDeclares(key))
    ) {
      return false;
    }
    // A key required here also makes the enclosing schema's own property of
    // that name required, which a reference cannot do.
    if (facts.requiredKeys().some((key) => site.declaredKeys.has(key))) {
      return false;
    }
    // A required-only alternative becomes the parent's own object, which a
    // reference cannot do.
    if (site.narrowsOwnObject && facts.requiredKeys().length > 0) {
      return false;
    }
    // A nullable alternative is hoisted onto the parent's own object.
    if (site.hoistsNull && facts.acceptsNull()) return false;
    if (direction && reachesDirection(ref, context, direction)) return false;
    // The flagged key is stripped from its declaration, so a member that
    // requires it would reject every valid instance.
    const flagged = direction ? site.directionalKeys[direction] : undefined;
    if (
      flagged?.size &&
      facts.requiredKeysAnywhere().some((key) => flagged.has(key))
    ) {
      return false;
    }
    return !needsRequiredKeys(facts, site.requiredKeys);
  };
  return Object.assign(policy, { direction });
};
