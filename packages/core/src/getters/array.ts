import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs, ScalarValue } from '../types';
import { resolveObject } from '../resolvers/object';

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = ({
  schema,
  name,
  context,
}: {
  schema: SchemaObject;
  name?: string;
  context: ContextSpecs;
}): ScalarValue => {
  if (schema.items) {
    const resolvedObject = resolveObject({
      schema: schema.items,
      propName: name + 'Item',
      context,
    });
    return {
      value: resolvedObject.value.includes('|')
        ? `(${resolvedObject.value})[]`
        : `${resolvedObject.value}[]`,
      imports: resolvedObject.imports,
      schemas: resolvedObject.schemas,
      isEnum: false,
      type: 'array',
      isRef: false,
      hasReadonlyProps: resolvedObject.hasReadonlyProps,
    };
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
};
