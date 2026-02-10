import { isObject } from './assertion';

export function mergeDeep<
  T extends Record<string, any>,
  U extends Record<string, any>,
>(source: T, target: U): T & U {
  if (!isObject(target) || !isObject(source)) {
    return source as T & U;
  }

  const acc = Object.assign({}, source);
  for (const [key, value] of Object.entries(target)) {
    const sourceValue = acc[key];

    if (Array.isArray(sourceValue) && Array.isArray(value)) {
      (acc[key] as any) = [...sourceValue, ...value];
    } else if (isObject(sourceValue) && isObject(value)) {
      (acc[key] as any) = mergeDeep(sourceValue, value);
    } else {
      (acc[key] as any) = value;
    }
  }
  return acc as T & U;
}
