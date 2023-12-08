import { SchemaObject } from 'openapi3-ts';
import { ContextSpecs, ScalarValue } from '../types';
import { resolveObject } from '../resolvers/object';
import { resolveExampleRefs } from '../resolvers';

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
      value: `${schema.readOnly === true ? 'readonly ' : ''}${
        resolvedObject.value.includes('|')
          ? `(${resolvedObject.value})[]`
          : `${resolvedObject.value}[]`
      }`,
      imports: resolvedObject.imports,
      schemas: resolvedObject.schemas,
      isEnum: false,
      type: 'array',
      isRef: false,
      hasReadonlyProps: resolvedObject.hasReadonlyProps,
      example: schema.example,
      examples: resolveExampleRefs(schema.examples, context),
    };
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
};
