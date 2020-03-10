import {SchemaObject} from 'openapi3-ts';
import {isReference} from '../isReference';
import {resolveValue} from '../resolvers/resolveValue';

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = (
  item: SchemaObject,
  name?: string
): {
  value: string;
  imports?: string[];
  schemas?: Array<{name: string; model: string; imports?: string[]}>;
} => {
  if (item.items) {
    if (!isReference(item.items) && (item.items.oneOf || item.items.allOf)) {
      const {value, imports, schemas} = resolveValue(item.items, name + 'Item');
      return {value: `(${value})[]`, imports, schemas};
    } else {
      const {value, imports, schemas} = resolveValue(item.items, name + 'Item');
      return {value: `${value}[]`, imports, schemas};
    }
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
};
