import {SchemaObject} from 'openapi3-ts';
import {resolveValue} from '../resolvers/resolveValue';
import { isReference } from '../../utils/is';
import { ResolverValue } from '../../types/resolvers';

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = (
  item: SchemaObject,
  name?: string
): ResolverValue => {
  if (item.items) {
    if (!isReference(item.items) && (item.items.oneOf || item.items.allOf)) {
      const {value, imports, schemas} = resolveValue(item.items, name + 'Item');
      return {value: `(${value})[]`, imports, schemas, isEnum: false, type: 'array'};
    } else {
      const {value, imports, schemas} = resolveValue(item.items, name + 'Item');
      return {value: `${value}[]`, imports, schemas, isEnum: false, type: 'array'};
    }
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
};
