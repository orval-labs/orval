import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { InputTarget } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { resolveObject } from '../resolvers/object';

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = async ({
  schema,
  name,
  schemas,
  target,
}: {
  schema: SchemaObject;
  name?: string;
  schemas: SchemasObject;
  target: InputTarget;
}): Promise<ResolverValue> => {
  if (schema.items) {
    const resolvedObject = await resolveObject({
      schema: schema.items,
      propName: name + 'Item',
      schemas,
      target,
    });
    return {
      value: `${resolvedObject.value}[]`,
      imports: resolvedObject.imports,
      schemas: resolvedObject.schemas,
      isEnum: false,
      type: 'array',
    };
  } else {
    throw new Error('All arrays must have an `items` key define');
  }
};
