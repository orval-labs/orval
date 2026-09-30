import { camel, pascal } from './case';

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
 * Resolves the PascalCase base name of every key in a `components` section
 * (e.g. `components.schemas`), so distinct keys that only differ in casing or
 * separators (`Address` and `address`) never share a generated TypeScript
 * name. Within each colliding group the key already spelled in PascalCase (or
 * else the first declared) keeps the plain name; the others get the first free
 * numeric suffix (`Address2`). Memoized per section object.
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
    const base = pascal(key);
    const group = groups.get(base);
    if (group) {
      group.push(key);
    } else {
      groups.set(base, [key]);
    }
  }

  const reservedNames = new Set(groups.keys());
  const names = new Map<string, string>();
  for (const [base, keys] of groups) {
    const owner = keys.find((key) => key === base) ?? keys[0];
    names.set(owner, base);

    for (const key of keys) {
      if (key === owner) continue;
      const uniqueName = getUniqueName(base, reservedNames);
      reservedNames.add(uniqueName);
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
