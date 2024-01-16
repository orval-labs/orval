const isObject = (obj: unknown) => obj && typeof obj === 'object';

export function mergeDeep<T extends Record<string, any>>(
  source: T,
  target: T,
): T {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  return Object.entries(target).reduce(
    (acc, [key, value]) => {
      const sourceValue = acc[key];

      if (Array.isArray(sourceValue) && Array.isArray(value)) {
        (acc[key] as any) = [...sourceValue, ...value];
      } else if (isObject(sourceValue) && isObject(value)) {
        (acc[key] as any) = mergeDeep(sourceValue, value);
      } else {
        (acc[key] as any) = value;
      }

      return acc;
    },
    Object.assign({}, source),
  );
}
