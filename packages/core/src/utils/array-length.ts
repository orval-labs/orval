import { isObject } from './assertion';

const MAX_TUPLE_LENGTH = 8;

/**
 * Bounds for a homogeneous array we can represent with a small tuple union.
 * A missing minimum is zero, and an omitted maximum leaves the array unbounded.
 */
export function getArrayLengthTupleBounds({
  type,
  items,
  prefixItems,
  minItems = 0,
  maxItems,
}: Record<string, unknown>): { min: number; max: number } | undefined {
  if (
    (type !== undefined &&
      type !== 'array' &&
      !(Array.isArray(type) && type.includes('array'))) ||
    prefixItems !== undefined ||
    (items !== true && !isObject(items)) ||
    typeof minItems !== 'number' ||
    typeof maxItems !== 'number' ||
    !Number.isInteger(minItems) ||
    !Number.isInteger(maxItems) ||
    minItems < 0 ||
    maxItems < minItems ||
    maxItems > MAX_TUPLE_LENGTH
  ) {
    return undefined;
  }
  return { min: minItems, max: maxItems };
}
