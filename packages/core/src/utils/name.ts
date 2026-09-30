import { camel, pascal } from './case';
import { sanitize } from './string';

/**
 * Returns `name` or the first deterministic numeric suffix not in
 * `reservedNames`.
 */
export function getUniqueName(
  name: string,
  reservedNames: ReadonlySet<string>,
): string {
  let candidate = name;
  let index = 2;

  while (reservedNames.has(candidate)) {
    candidate = `${name}${index}`;
    index += 1;
  }

  return candidate;
}

/**
 * Resolves URL helper names while reserving every generated operation name.
 * The returned names correspond to `helperOperationNames` in order.
 */
export function getOperationUrlHelperNames(
  operationNames: readonly string[],
  helperOperationNames: readonly string[],
): string[] {
  const reservedNames = new Set(operationNames);

  return helperOperationNames.map((operationName) => {
    const helperName = getUniqueName(
      camel(`get-${operationName}-url`),
      reservedNames,
    );
    reservedNames.add(helperName);
    return helperName;
  });
}

const componentBaseNamesCache = new WeakMap<object, Map<string, string>>();

/**
 * The identifier a base name ends up as once the definition/ref generators
 * sanitize it (`1Address` → `N1Address`, keyword → `_keyword`). Collisions are
 * checked on this form so two keys cannot meet only after sanitization. The
 * section's prefix/suffix are constant, so they are left out: at worst a name
 * that would only collide without an affix is disambiguated anyway.
 */
function toComponentIdentifier(baseName: string): string {
  return sanitize(baseName, {
    underscore: true,
    dash: true,
    es5keyword: true,
    es5IdentifierName: true,
  });
}

/**
 * Resolves the PascalCase base name of every key in a `components` section
 * (e.g. `components.schemas`), so distinct keys that only differ in casing or
 * separators (`Address` and `address`) never share a generated TypeScript
 * name. Within each colliding group the key already spelled in PascalCase (or
 * else the first declared) keeps the plain name; the others get the first
 * numeric suffix whose sanitized identifier is still free (`Address2`).
 * Memoized per section object.
 */
export function getComponentBaseNames(
  section: object | undefined,
): ReadonlyMap<string, string> {
  if (!section) {
    return new Map();
  }

  const cached = componentBaseNamesCache.get(section);
  if (cached) {
    return cached;
  }

  const groups = new Map<string, string[]>();
  for (const key of Object.keys(section)) {
    const identifier = toComponentIdentifier(pascal(key));
    const group = groups.get(identifier);
    if (group) {
      group.push(key);
    } else {
      groups.set(identifier, [key]);
    }
  }

  const reservedIdentifiers = new Set(groups.keys());
  const names = new Map<string, string>();
  for (const keys of groups.values()) {
    const owner = keys.find((key) => key === pascal(key)) ?? keys[0];
    names.set(owner, pascal(owner));

    for (const key of keys) {
      if (key === owner) continue;
      const base = pascal(key);
      let index = 2;
      let uniqueName = `${base}${index}`;
      while (reservedIdentifiers.has(toComponentIdentifier(uniqueName))) {
        index += 1;
        uniqueName = `${base}${index}`;
      }
      reservedIdentifiers.add(toComponentIdentifier(uniqueName));
      names.set(key, uniqueName);
    }
  }

  componentBaseNamesCache.set(section, names);
  return names;
}

/**
 * Returns the collision-free PascalCase base name of component `key` within
 * `section`. See {@link getComponentBaseNames}.
 */
export function getComponentBaseName(
  section: object | undefined,
  key: string,
): string {
  return getComponentBaseNames(section).get(key) ?? pascal(key);
}
