import { isObject } from './assertion';

export function mergeDeep<T extends object, U extends object>(
  source: T,
  target: U,
): T & U {
  if (!isObject(target) || !isObject(source)) {
    return source as T & U;
  }

  const acc = Object.assign({}, source) as Record<string, unknown>;
  for (const [key, value] of Object.entries(target)) {
    const sourceValue = acc[key];

    if (Array.isArray(sourceValue) && Array.isArray(value)) {
      acc[key] = [...(sourceValue as unknown[]), ...(value as unknown[])];
    } else if (isObject(sourceValue) && isObject(value)) {
      acc[key] = mergeDeep(sourceValue, value);
    } else {
      acc[key] = value;
    }
  }
  return acc as T & U;
}
