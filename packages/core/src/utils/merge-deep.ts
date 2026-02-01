import { isFunction } from './assertion';

const isObject = (obj: unknown): obj is Record<string, unknown> =>
  obj === Object(obj) && !isFunction(obj);

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
        (acc[key] as any) = [...sourceValue, ...value];
      } else if (isObject(sourceValue) && isObject(value)) {
        (acc[key] as any) = mergeDeep(sourceValue, value);
      } else {
        (acc[key] as any) = value;
      }

      return acc;
    },
    Object.assign({}, source),
  ) as T & U;
}
