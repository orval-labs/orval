import { keyword } from 'esutils';

import { jsStringLiteralEscape } from '../utils';

export function getKey(key: string) {
  return keyword.isIdentifierNameES5(key)
    ? key
    : `'${jsStringLiteralEscape(key)}'`;
}

/**
 * Emits a schema-derived name as a TypeScript *string literal type*
 * (`'petId'`), for the key positions of `Pick`, `Omit` and `Extract`.
 *
 * The sibling {@link getKey} covers the property-key position, where a valid
 * identifier may be emitted bare. A string literal type has no bare form —
 * `Extract<keyof T, petId>` is a type *reference*, not the literal `'petId'` —
 * so the name is always quoted, and therefore always has to be escaped. Left
 * unescaped, a `'` in a schema name closes the literal and the rest of the
 * name is emitted as sibling top-level source in `export type X = …;`, which
 * survives type erasure and runs when the generated module is imported
 * (GHSA-6h9g-hcv4-66p6).
 */
export function getStringLiteralType(name: string) {
  return `'${jsStringLiteralEscape(name)}'`;
}

/**
 * Joins schema-derived names into a union of string literal types
 * (`'a' | 'b'`). See {@link getStringLiteralType}.
 */
export function getStringLiteralTypeUnion(names: readonly string[]) {
  return names.map((name) => getStringLiteralType(name)).join(' | ');
}

/**
 * Emits a property access for a possibly non-identifier name: dot access for
 * valid identifier names (`.petId`), quoted bracket access otherwise
 * (`['scope.id']`).
 */
export function getPropertyAccessor(name: string) {
  return keyword.isIdentifierNameES5(name) ? `.${name}` : `[${getKey(name)}]`;
}

/**
 * Returns a Set of property keys that, after applying `conventionName`,
 * would collide with another key (e.g. `first_name` and `firstName` both
 * convert to `firstName` under camelCase). The generator falls back to the
 * original (unique) schema key for these so the emitted type stays
 * collision-free. Returns an empty Set when no convention is configured.
 */
export function getPropertyNameCollisionKeys(
  keys: string[],
  convention?: (name: string) => string,
): Set<string> {
  const collisionKeys = new Set<string>();
  if (!convention) {
    return collisionKeys;
  }
  const convertedNames = new Map<string, string[]>();
  for (const key of keys) {
    const converted = convention(key);
    const bucket = convertedNames.get(converted) ?? [];
    bucket.push(key);
    convertedNames.set(converted, bucket);
  }
  for (const bucket of convertedNames.values()) {
    if (bucket.length > 1) {
      for (const key of bucket) {
        collisionKeys.add(key);
      }
    }
  }
  return collisionKeys;
}
