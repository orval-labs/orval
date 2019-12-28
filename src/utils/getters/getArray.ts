import { SchemaObject } from 'openapi3-ts';
import { isReference } from '../isReference';
import { resolveValue } from '../resolvers/resolveValue';

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = (item: SchemaObject): { value: string; imports?: string[] } => {
  if (item.items) {
    if (!isReference(item.items) && (item.items.oneOf || item.items.allOf)) {
      const { value, imports } = resolveValue(item.items);
      return { value: `(${value})[]`, imports };
    } else {
      const { value, imports } = resolveValue(item.items);
      return { value: `${value}[]`, imports };
    }
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
};
