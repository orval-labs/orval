/**
 * Type safe way to get arbitrary property from an object.
 *
 * @param obj - The object from which to retrieve the property.
 * @param propertyName - The name of the property to retrieve.
 * @returns Object with `hasProperty: true` and `value` of the property if it exists; otherwise `hasProperty: false` and undefined.
 *
 * @remarks Until TypeScript adds type-narrowing for Object.hasOwn we have to use this workaround
 */
export function getPropertySafe<T extends object, K extends keyof T>(
  obj: T,
  propertyName: K | string,
):
  | { hasProperty: true; value: T[K] }
  | { hasProperty: false; value: undefined } {
  if (Object.hasOwn(obj, propertyName)) {
    // safe to cast here because of the above check
    return { hasProperty: true, value: obj[propertyName as K] };
  }

  return { hasProperty: false, value: undefined };
}
