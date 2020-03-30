import { SchemaObject } from 'openapi3-ts';
import { ResolverValue } from '../../types/resolvers';
import { resolveObject } from '../resolvers/object';

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = (item: SchemaObject, name?: string): ResolverValue => {
  if (item.items) {
    const { value, imports, schemas } = resolveObject(
      item.items,
      name + 'Item',
    );
    return {
      value: `${value}[]`,
      imports,
      schemas,
      isEnum: false,
      type: 'array',
    };
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
};
