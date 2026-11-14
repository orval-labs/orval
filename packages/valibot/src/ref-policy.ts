import {
  type ContextSpec,
  createSharedRefPolicy,
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
  const policy = createSharedRefPolicy(
    context,
    direction,
    (_ref, site, facts) => {
      // A strict object would reject the keys of the members it is merged with.
      if (strict && site.mergesMembers) return true;
      // A transformed member would not merge with its siblings.
      if (site.inIntersection && facts.hasTransform()) return true;
      // A required key nothing declares is dropped from an `allOf` member.
      if (site.inAllOf && requiresUndeclaredKey(facts)) return true;
      // The required keys reach a sibling through the schema's `required`,
      // which a reference hides.
      if (
        site.inAllOf &&
        facts.requiredKeys().some((key) => site.siblingDeclares(key))
      ) {
        return true;
      }
      // A key required here also makes the enclosing schema's own property of
      // that name required, which a reference cannot do.
      if (facts.requiredKeys().some((key) => site.declaredKeys.has(key))) {
        return true;
      }
      // A required-only alternative becomes the parent's own object, which a
      // reference cannot do.
      if (site.narrowsOwnObject && facts.requiredKeys().length > 0) return true;
      // A nullable alternative is hoisted onto the parent's own object.
      if (site.hoistsNull && facts.acceptsNull()) return true;
      // The flagged key is stripped from its declaration, so a member that
      // requires it would reject every valid instance.
      const flagged = direction ? site.directionalKeys[direction] : undefined;
      return (
        !!flagged?.size &&
        facts.requiredKeysAnywhere().some((key) => flagged.has(key))
      );
    },
  );
  return Object.assign(policy, { direction });
};
