import { SchemaObject } from 'openapi3-ts/oas30';
import { SchemaObject as SchemaObject31 } from 'openapi3-ts/oas31';
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
    const schema31 = schema as SchemaObject31;
    if (schema31.prefixItems) {
      // TODO: https://github.com/anymaniax/orval/issues/890
      throw new Error(
        `prefixItems is not supported (name=${name}, schema=${JSON.stringify(schema)})`,
      );
    }
    const resolvedObject = resolveObject({
      schema: schema.items,
      propName: name + context.output.override.components.schemas.itemSuffix,
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
    throw new Error(
      `All arrays must have an \`items\` key defined (name=${name}, schema=${JSON.stringify(schema)})`,
    );
  }
};
