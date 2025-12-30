import { resolveExampleRefs } from '../resolvers';
import { resolveObject } from '../resolvers/object';
import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ScalarValue,
} from '../types';
import { compareVersions } from '../utils';

interface GetArrayOptions {
  schema: OpenApiSchemaObject;
  name?: string;
  context: ContextSpec;
}

/**
 * Return the output type from an array
 *
 * @param item item with type === "array"
 */
export function getArray({
  schema,
  name,
  context,
}: GetArrayOptions): ScalarValue {
  const schema31 = schema as OpenApiSchemaObject;
  if (schema31.prefixItems) {
    const resolvedObjects = schema31.prefixItems.map((item, index) =>
      resolveObject({
        schema: item as OpenApiSchemaObject | OpenApiReferenceObject,
        propName:
          name + context.output.override.components.schemas.itemSuffix + index,
        context,
      }),
    );
    if (schema31.items) {
      const additional = resolveObject({
        schema: schema31.items as OpenApiSchemaObject | OpenApiReferenceObject,
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
      isEnum: false,
      isRef: false,
      value: `[${resolvedObjects.map((o) => o.value).join(', ')}]`,
      imports: resolvedObjects.flatMap((o) => o.imports),
      schemas: resolvedObjects.flatMap((o) => o.schemas),
      dependencies: resolvedObjects.flatMap((o) => o.dependencies),
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
      imports: resolvedObject.imports,
      schemas: resolvedObject.schemas,
      dependencies: resolvedObject.dependencies,
      isEnum: false,
      type: 'array',
      isRef: false,
      hasReadonlyProps: resolvedObject.hasReadonlyProps,
      example: schema.example,
      examples: resolveExampleRefs(schema.examples, context),
    };
  } else if (compareVersions(context.spec.openapi, '3.1', '>=')) {
    return {
      value: 'unknown[]',
      imports: [],
      schemas: [],
      dependencies: [],
      isEnum: false,
      type: 'array',
      isRef: false,
      hasReadonlyProps: false,
    };
  } else {
    throw new Error(
      `All arrays must have an \`items\` key defined (name=${name}, schema=${JSON.stringify(schema)})`,
    );
  }
}
