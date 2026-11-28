import { resolveExampleRefs } from '../resolvers';
import { resolveObject } from '../resolvers/object';
import type {
  ContextSpec,
  OpenApiSchemaObject,
  ResolverValue,
  ScalarValue,
} from '../types';
import { compareVersions, toObjectSchema } from '../utils';
import { getArrayLengthTupleBounds } from '../utils/array-length';
import type { FormDataContext } from './object';

interface GetArrayOptions {
  schema: OpenApiSchemaObject;
  name?: string;
  context: ContextSpec;
  formDataContext?: FormDataContext;
}

// Nested inline item types can grow even when every individual length is small.
const MAX_REPEATED_ITEM_TYPE_LENGTH = 4096;

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
  schema = toObjectSchema(schema);
  const schemaPrefixItems = schema.prefixItems;
  const schemaItems = schema.items;
  const schemaExample = schema.example as unknown;
  const schemaExamples = schema.examples as Parameters<
    typeof resolveExampleRefs
  >[0];

  const itemPrefix =
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    context.output.override.components.schemas.itemPrefix ?? '';
  const itemSuffix =
    // oxlint-disable-next-line typescript/no-unnecessary-condition
    context.output.override.components.schemas.itemSuffix ?? '';
  const useReadonlyArrays = context.output.override.useReadonlyArrays ?? false;
  if (schemaPrefixItems) {
    const resolvedObjects: ResolverValue[] = schemaPrefixItems.map(
      (item, index) =>
        resolveObject({
          schema: item,
          propName: name
            ? itemPrefix + name + itemSuffix + String(index)
            : undefined,
          context,
        }),
    );
    if (schemaItems) {
      const additional = resolveObject({
        schema: schemaItems,
        propName: name
          ? itemPrefix + name + itemSuffix + 'Additional'
          : undefined,
        context,
      });
      resolvedObjects.push({
        ...additional,
        value: `...${
          (useReadonlyArrays || additional.isArrayLengthTuple) &&
          (additional.value.includes('|') ||
            additional.value.includes('&') ||
            additional.value.startsWith('readonly '))
            ? `(${additional.value})`
            : additional.value
        }[]`,
      });
    }
    return {
      type: 'array',
      isEnum: false,
      isRef: false,
      value: `${useReadonlyArrays ? 'readonly ' : ''}[${resolvedObjects.map((o) => o.value).join(', ')}]`,
      imports: resolvedObjects.flatMap((o) => o.imports),
      schemas: resolvedObjects.flatMap((o) => o.schemas),
      dependencies: resolvedObjects.flatMap((o) => o.dependencies),
      hasReadonlyProps: resolvedObjects.some((o) => o.hasReadonlyProps),
      example: schemaExample,
      examples: resolveExampleRefs(schemaExamples, context),
    };
  }
  if (schemaItems) {
    const readOnly =
      useReadonlyArrays ||
      (schema.readOnly === true &&
        !context.output.override.suppressReadonlyModifier)
        ? 'readonly '
        : '';
    const bounds = context.output.override.useArrayLengthTuples
      ? getArrayLengthTupleBounds(schema)
      : undefined;
    const resolvedObject =
      bounds?.max === 0
        ? undefined
        : resolveObject({
            schema: schemaItems,
            propName: name ? itemPrefix + name + itemSuffix : undefined,
            context,
            formDataContext,
          });
    const itemType = resolvedObject?.value ?? 'never';
    const tupleBounds =
      bounds &&
      itemType.length * bounds.max * (bounds.max - bounds.min + 1) <=
        MAX_REPEATED_ITEM_TYPE_LENGTH
        ? bounds
        : undefined;
    const value = tupleBounds
      ? Array.from(
          { length: tupleBounds.max - tupleBounds.min + 1 },
          (_, index) => {
            const items = Array.from(
              { length: tupleBounds.min + index },
              () => itemType,
            );
            return `${readOnly}[${items.join(', ')}]`;
          },
        ).join(' | ')
      : `${readOnly}${
          itemType.includes('|') ||
          itemType.includes('&') ||
          ((useReadonlyArrays || resolvedObject?.isArrayLengthTuple) &&
            itemType.startsWith('readonly '))
            ? `(${itemType})`
            : itemType
        }[]`;
    return {
      value,
      ...(tupleBounds && { isArrayLengthTuple: true }),
      imports: resolvedObject?.imports ?? [],
      schemas: resolvedObject?.schemas ?? [],
      dependencies: resolvedObject?.dependencies ?? [],
      isEnum: false,
      type: 'array',
      isRef: false,
      hasReadonlyProps: resolvedObject?.hasReadonlyProps ?? false,
      example: schemaExample,
      examples: resolveExampleRefs(schemaExamples, context),
    };
    // oxlint-disable-next-line typescript/no-unnecessary-condition
  } else if (compareVersions(context.spec.openapi ?? '3.0.0', '3.1', '>=')) {
    return {
      value: useReadonlyArrays ? 'readonly unknown[]' : 'unknown[]',
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
