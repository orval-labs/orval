import { resolveExampleRefs } from '../resolvers/index.ts';
import { resolveObject } from '../resolvers/object.ts';
import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  ResolverValue,
  ScalarValue,
} from '../types.ts';
import { compareVersions } from '../utils/index.ts';
import type { FormDataContext } from './object.ts';

interface GetArrayOptions {
  schema: OpenApiSchemaObject;
  name?: string;
  context: ContextSpec;
  formDataContext?: FormDataContext;
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
  formDataContext,
}: GetArrayOptions): ScalarValue {
  // Bridge assertions: extract typed values from AnyOtherAttribute-infected schema
  const schemaPrefixItems = schema.prefixItems as
    | (OpenApiSchemaObject | OpenApiReferenceObject)[]
    | undefined;
  const schemaItems = schema.items as
    | OpenApiSchemaObject
    | OpenApiReferenceObject
    | undefined;
  const schemaExample = schema.example as unknown;
  const schemaExamples = schema.examples as Parameters<
    typeof resolveExampleRefs
  >[0];

  const itemSuffix = context.output.override.components.schemas.itemSuffix;
  if (schemaPrefixItems) {
    const resolvedObjects: ResolverValue[] = schemaPrefixItems.map(
      (item, index) =>
        resolveObject({
          schema: item,
          propName: name ? name + itemSuffix + String(index) : undefined,
          context,
        }),
    );
    if (schemaItems) {
      const additional = resolveObject({
        schema: schemaItems,
        propName: name ? name + itemSuffix + 'Additional' : undefined,
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
      example: schemaExample,
      examples: resolveExampleRefs(schemaExamples, context),
    };
  }
  if (schemaItems) {
    const resolvedObject = resolveObject({
      schema: schemaItems,
      propName: name ? name + itemSuffix : undefined,
      context,
      formDataContext,
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
      example: schemaExample,
      examples: resolveExampleRefs(schemaExamples, context),
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
