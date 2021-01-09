import { SchemaObject, SchemasObject } from 'openapi3-ts';
import { OverrideOutput } from '../../types';
import { ResolverValue } from '../../types/resolvers';
import { resolveObject } from '../resolvers/object';

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export const getArray = ({
  schema,
  name,
  schemas,
  override,
}: {
  schema: SchemaObject;
  name?: string;
  schemas: SchemasObject;
  override: OverrideOutput;
}): ResolverValue => {
  if (schema.items) {
    const resolvedObject = resolveObject({
      schema: schema.items,
      propName: name + 'Item',
      schemas,
      override,
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
