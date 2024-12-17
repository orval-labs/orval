import { ReferenceObject, SchemaObject } from 'openapi3-ts/oas30';
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
  const schema31 = schema as SchemaObject31;
  if (schema31.prefixItems) {
    const resolvedObjects = schema31.prefixItems.map((item, index) =>
      resolveObject({
        schema: item as SchemaObject | ReferenceObject,
        propName:
          name + context.output.override.components.schemas.itemSuffix + index,
        context,
      }),
    );
    if (schema31.items) {
      const additional = resolveObject({
        schema: schema31.items as SchemaObject | ReferenceObject,
        propName:
          name +
          context.output.override.components.schemas.itemSuffix +
          'Additional',
        context,
      });
      resolvedObjects.push({
        ...additional,
        value: `...${additional.value}[]`,
      });
    }
    return {
      type: 'array',
      factoryMethodValue: `[]`,
      isEnum: false,
      isRef: false,
      value: `[${resolvedObjects.map((o) => o.value).join(', ')}]`,
      imports: resolvedObjects.flatMap((o) => o.imports),
      schemas: resolvedObjects.flatMap((o) => o.schemas),
      hasReadonlyProps: resolvedObjects.some((o) => o.hasReadonlyProps),
      example: schema.example,
      examples: resolveExampleRefs(schema.examples, context),
    };
  }
  if (schema.items) {
    const resolvedObject = resolveObject({
      schema: schema.items,
      propName: name + context.output.override.components.schemas.itemSuffix,
      context,
    });
    return {
      value: `${
        schema.readOnly === true &&
        !context.output.override.suppressReadonlyModifier
          ? 'readonly '
          : ''
      }${
        resolvedObject.value.includes('|')
          ? `(${resolvedObject.value})[]`
          : `${resolvedObject.value}[]`
      }`,
      factoryMethodValue: `[]`,
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
