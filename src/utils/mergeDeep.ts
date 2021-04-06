const isObject = (obj: unknown) => obj && typeof obj === 'object';

export function mergeDeep<T extends Record<string, any>>(
  source: T,
  target: T,
): T {
  if (!isObject(target) || !isObject(source)) {
    return source;
  }

  return Object.entries(target).reduce((acc, [key, value]) => {
    const sourceValue = acc[key];

    if (Array.isArray(sourceValue) && Array.isArray(value)) {
      return { ...acc, [key]: [...sourceValue, ...value] };
    }
    if (isObject(sourceValue) && isObject(value)) {
      return { ...acc, [key]: mergeDeep(sourceValue, value) };
    }
    return { ...acc, [key]: value };
  }, source);
}
