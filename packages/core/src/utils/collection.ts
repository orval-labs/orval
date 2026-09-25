/** Keeps the first occurrence of every value. */
export const unique = <T>(values: readonly T[]): T[] => [...new Set(values)];

/** Keeps the first item for every distinct `key(item)`. */
export function uniqueBy<T>(
  items: T[],
  key: (item: T, index: number, items: T[]) => unknown,
): T[] {
  const seen = new Set<unknown>();
  return items.filter((item, index, all) => {
    const k = key(item, index, all);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** Keeps the first of every run of items that `isEqual` treats as the same. */
export const uniqueWith = <T>(
  items: readonly T[],
  isEqual: (a: T, b: T) => boolean,
): T[] =>
  items.filter(
    (item, index) =>
      items.findIndex((other, j) => j === index || isEqual(item, other)) ===
      index,
  );

/**
 * Buckets `items` by `key(item)` in first-seen order. Only keys that occur get
 * a bucket, so `get` on any other key is `undefined`.
 */
export const groupBy = <T>(
  items: readonly T[],
  key: (item: T) => string,
): Map<string, T[]> => Map.groupBy(items, key);

/** The subset of `obj` at `keys`; keys absent from `obj` are left out. */
export const pick = <T extends object, K extends keyof T>(
  obj: T,
  keys: Iterable<K>,
): Pick<T, K> =>
  Object.fromEntries(
    [...keys]
      .filter((key) => Object.hasOwn(obj, key))
      .map((key) => [key, obj[key]]),
  ) as Pick<T, K>;

/** `obj` without the entries `drop` returns true for. */
export const omitBy = <T extends object>(
  obj: T,
  drop: (value: T[keyof T], key: string) => boolean,
): Partial<T> =>
  Object.fromEntries(
    Object.entries(obj).filter(
      ([key, value]) => !drop(value as T[keyof T], key),
    ),
  ) as Partial<T>;

/** Walks `path` into `value`; `undefined` as soon as a step is missing. */
export const getAtPath = (
  value: unknown,
  path: readonly PropertyKey[],
): unknown =>
  // oxlint-disable-next-line unicorn/no-array-reduce
  path.reduce<unknown>(
    (current, key) =>
      current === null || current === undefined
        ? undefined
        : (current as Record<PropertyKey, unknown>)[key],
    value,
  );
