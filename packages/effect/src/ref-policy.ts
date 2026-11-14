import {
  type ContextSpec,
  createSharedRefPolicy,
  isObject,
  type RefPolicy,
  resolveSelf,
  type SchemaDirection,
} from '@orval/core';

import { isReusableSchemasEnabled } from './refs';

interface RefPolicyOptions {
  context: ContextSpec;
  // The exactOptional of the site the schema is generated for.
  exactOptional: boolean;
  // The properties a schema in this direction must not carry; refs to a
  // schema that holds some stay inline so they can be stripped.
  direction?: SchemaDirection;
}

// Whether the schema behind a ref, through aliases, is flagged itself. A
// flagged property is dropped or left optional by its parent, which cannot see
// the flag through a reference.
const isFlagged = (ref: string, context: ContextSpec): boolean => {
  const { schema } = resolveSelf({ $ref: ref }, context, new Set());
  return (
    isObject(schema) && (schema.readOnly === true || schema.writeOnly === true)
  );
};

/** Which refs stay references. Undefined when reusable schemas are off. */
export const createRefPolicy = ({
  context,
  exactOptional,
  direction,
}: RefPolicyOptions): RefPolicy | undefined => {
  if (!isReusableSchemasEnabled(context)) return undefined;
  // A constant cannot follow a site that renders optional keys differently.
  if (exactOptional !== context.output.override.effect.exactOptional) {
    return () => false;
  }
  return createSharedRefPolicy(
    context,
    direction,
    (ref, site) =>
      // Members are merged by their fields, which a constant may not expose,
      // and a merge recognises open members by their shape.
      site.mergesMembers ||
      site.inAllOf ||
      site.inIntersection ||
      site.hoistsNull ||
      site.narrowsOwnObject ||
      isFlagged(ref, context),
  );
};

/**
 * The policy for a root schema. An array root is generated as its items, so
 * the references it reaches the array through are inlined and the items keep
 * theirs.
 */
export const createRootRefPolicy = (
  policy: RefPolicy | undefined,
  root: unknown,
  context: ContextSpec,
): RefPolicy | undefined => {
  if (!policy) return undefined;
  const { schema, followed } = resolveSelf(root, context, new Set());
  if (!isObject(schema) || !schema.items) return policy;
  return (ref, site) => !followed.has(ref) && policy(ref, site);
};
