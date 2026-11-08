import { isObject, omitBy } from '@orval/core';

import { getRef } from './refs';

/** Finds the schema a `$ref` points at. */
export type RefLookup = (ref: string) => unknown;

export interface ResolvedAlias {
  schema: unknown;
  // The refs followed to reach the schema, so a cycle is cut.
  followed: ReadonlySet<string>;
}

export const withoutRef = (
  schema: Record<string, unknown>,
): Record<string, unknown> => omitBy(schema, (_, key) => key === '$ref');

/**
 * Follows an alias component to its schema, keeping `$ref` siblings like
 * inlining does. An unresolved or cyclic ref is left in place.
 */
export const followAliases = (
  schema: unknown,
  lookup: RefLookup,
  followed: ReadonlySet<string> = new Set(),
): ResolvedAlias => {
  let current = schema;
  let path: Set<string> | undefined;
  for (;;) {
    const ref = getRef(current);
    if (ref === undefined || !isObject(current)) break;
    if ((path ?? followed).has(ref)) break;
    const target = lookup(ref);
    if (!isObject(target)) break;
    path ??= new Set(followed);
    path.add(ref);
    current = { ...target, ...withoutRef(current) };
  }
  return { schema: current, followed: path ?? followed };
};
