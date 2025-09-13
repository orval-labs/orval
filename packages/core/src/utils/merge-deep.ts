const isObject = (obj: unknown) => obj && typeof obj === 'object';

export function mergeDeep<
  T extends Record<string, any>,
  U extends Record<string, any>,
>(source: T, target: U): T & U {
  if (!isObject(target) || !isObject(source)) {
    return source as T & U;
  }

  return Object.entries(target).reduce(
    (acc, [key, value]) => {
      const sourceValue = acc[key];

      if (Array.isArray(sourceValue) && Array.isArray(value)) {
        acc[key] = [...sourceValue, ...value];
      } else if (isObject(sourceValue) && isObject(value)) {
        acc[key] = mergeDeep(sourceValue, value);
      } else {
        acc[key] = value;
      }

      return acc;
    },
    Object.assign({}, source),
  ) as T & U;
}
