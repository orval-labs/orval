import { isArray, isBoolean } from 'remeda';

import type {
  ContextSpec,
  OpenApiReferenceObject,
  OpenApiSchemaObject,
  OpenApiSchemasObject,
} from '../types';
import { getPropertySafe, isReference, pascal } from '../utils';
import { getRefInfo } from './ref';

export function resolveDiscriminators(
  schemas: OpenApiSchemasObject,
  context: ContextSpec,
): OpenApiSchemasObject {
  const transformedSchemas = schemas;
  for (const schema of Object.values(transformedSchemas)) {
    if (isBoolean(schema)) {
      continue; // skip boolean schemas as we can't do anything meaningful with them
    }

    // Some specs incorrectly nest `oneOf` under `discriminator`.
    // hoist it to the schema level so union generation still works.
    const discriminator = schema.discriminator as
      | { oneOf?: OpenApiSchemasObject[string][] }
      | undefined;

    if (!schema.oneOf && isArray(discriminator?.oneOf)) {
      schema.oneOf = discriminator.oneOf;
    }

    if (schema.discriminator?.mapping) {
      const { mapping, propertyName } = schema.discriminator;

      for (const [mappingKey, mappingValue] of Object.entries(mapping)) {
        let subTypeSchema;

        try {
          const { originalName } = getRefInfo(mappingValue, context);
          // name from getRefInfo may contain a suffix, which we don't want
          const name = pascal(originalName);
          subTypeSchema =
            transformedSchemas[name] ?? transformedSchemas[originalName];
        } catch {
          subTypeSchema = transformedSchemas[mappingValue];
        }

        // The mapped subtype may be missing from the schema set — e.g. a
        // subtype removed by `filters.tags`, or absent in a malformed spec —
        // in which case there is nothing to augment. Skip it rather than
        // dereferencing `undefined`.
        if (
          subTypeSchema === undefined ||
          isBoolean(subTypeSchema) ||
          propertyName === undefined
        ) {
          continue;
        }

        const property = subTypeSchema.properties?.[propertyName];
        if (isBoolean(property)) {
          continue;
        }

        const schemaProperty =
          property && !isReference(property) ? property : undefined;

        const enumProperty = schemaProperty
          ? getPropertySafe(schemaProperty, 'enum')
          : { hasProperty: false as const, value: undefined };

        const enumValues: unknown[] | undefined =
          enumProperty.hasProperty && Array.isArray(enumProperty.value)
            ? enumProperty.value
            : undefined;

        const propertyType =
          (schemaProperty?.type as string | undefined) ?? 'string';

        let typedMappingKey: string | number | boolean = mappingKey;
        if (propertyType === 'boolean') {
          typedMappingKey = mappingKey === 'true';
        } else if (propertyType === 'number' || propertyType === 'integer') {
          const parsed = Number(mappingKey);
          if (!Number.isNaN(parsed)) {
            typedMappingKey = parsed;
          }
        }

        const mergedEnumValues = [
          ...(enumValues ?? []).filter((value) => value !== typedMappingKey),
          typedMappingKey,
        ];

        // @see https://github.com/orval-labs/orval/issues/3139
        const mergedProperty = {
          ...schemaProperty,
          type: propertyType,
          enum: mergedEnumValues,
        };
        delete (mergedProperty as Record<string, unknown>).const;

        subTypeSchema.properties = {
          ...subTypeSchema.properties,
          [propertyName]: mergedProperty,
        };
        subTypeSchema.required = [
          ...new Set([...(subTypeSchema.required ?? []), propertyName]),
        ];
      }
    }
  }

  // Break the circular type-alias that forms when a discriminator parent has
  // top-level `oneOf` listing variants that inherit via `allOf: [$ref: parent, ...]`.
  // The parent emits as `type Parent = (Variant1 & {...}) | ...` and each variant
  // would emit as `type VariantN = Omit<Parent, key> & {...}`, producing TS2456.
  // Rewrite each variant's `$ref` back to the parent by inlining the parent's
  // non-discriminator properties (or dropping the entry entirely when the parent
  // contributes nothing beyond the discriminator key). See issue #3432.
  for (const [parentName, parentSchema] of Object.entries(transformedSchemas)) {
    if (isBoolean(parentSchema)) {
      continue;
    }
    const variants = parentSchema.oneOf ?? parentSchema.anyOf;
    if (!variants || !parentSchema.discriminator) {
      continue;
    }
    const { propertyName, mapping } = parentSchema.discriminator;
    if (!propertyName) {
      continue;
    }
    const mappedRefs = mapping ? Object.values(mapping) : [];
    const variantArrayRefs = variants
      .filter(
        (item): item is OpenApiReferenceObject & { $ref: string } =>
          isReference(item) && typeof item.$ref === 'string',
      )
      .map((item) => item.$ref);
    const variantRefs = [...new Set([...mappedRefs, ...variantArrayRefs])];

    const parentProperties = parentSchema.properties as
      | Record<string, OpenApiSchemaObject | OpenApiReferenceObject>
      | undefined;
    const parentRequired = parentSchema.required;
    const inheritableProps: Record<
      string,
      OpenApiSchemaObject | OpenApiReferenceObject
    > = {};
    if (parentProperties) {
      for (const [key, value] of Object.entries(parentProperties)) {
        if (key !== propertyName) {
          inheritableProps[key] = value;
        }
      }
    }
    const inheritableRequired = parentRequired?.filter(
      (key) => key !== propertyName,
    );
    const hasInheritableProps = Object.keys(inheritableProps).length > 0;

    for (const mappingValue of variantRefs) {
      let variantSchema;
      try {
        const { originalName } = getRefInfo(mappingValue, context);
        const name = pascal(originalName);
        variantSchema =
          transformedSchemas[name] ?? transformedSchemas[originalName];
      } catch {
        variantSchema = transformedSchemas[mappingValue];
      }
      if (!variantSchema || isBoolean(variantSchema)) {
        continue;
      }
      const variantAllOf = variantSchema.allOf as
        | (OpenApiSchemaObject | OpenApiReferenceObject)[]
        | undefined;
      if (!variantAllOf) {
        continue;
      }

      const rewritten: (OpenApiSchemaObject | OpenApiReferenceObject)[] = [];
      for (const item of variantAllOf) {
        if (!isReference(item) || !item.$ref) {
          rewritten.push(item);
          continue;
        }
        let refOriginalName: string | undefined;
        try {
          refOriginalName = getRefInfo(item.$ref, context).originalName;
        } catch {
          refOriginalName = undefined;
        }
        const refMatchesParent =
          refOriginalName === parentName ||
          (refOriginalName !== undefined &&
            pascal(refOriginalName) === pascal(parentName));
        if (!refMatchesParent) {
          rewritten.push(item);
          continue;
        }
        // Preserve the parent's other object-level constraints
        // (additionalProperties, minProperties, description, etc.) by shallow-
        // cloning the parent and only stripping the parts that would re-create
        // the cycle or are now meaningless on the variant.
        const inlinedParent = {
          ...(parentSchema as Record<string, unknown>),
        } as OpenApiSchemaObject;
        delete (inlinedParent as Record<string, unknown>).oneOf;
        delete (inlinedParent as Record<string, unknown>).discriminator;
        delete (inlinedParent as Record<string, unknown>).allOf;
        delete (inlinedParent as Record<string, unknown>).anyOf;

        if (hasInheritableProps) {
          // Fresh per-variant clone so downstream in-place mutations on one
          // variant don't leak across siblings.
          inlinedParent.properties = { ...inheritableProps };
        } else {
          delete (inlinedParent as Record<string, unknown>).properties;
        }
        if (inheritableRequired && inheritableRequired.length > 0) {
          inlinedParent.required = [...inheritableRequired];
        } else {
          delete (inlinedParent as Record<string, unknown>).required;
        }

        // Drop the entry entirely when the parent contributed nothing beyond
        // a bare `type: 'object'` — the second allOf member (the variant's
        // own inline object) already asserts object-ness.
        const meaningfulKeys = Object.keys(
          inlinedParent as Record<string, unknown>,
        ).filter((key) => key !== 'type');
        if (meaningfulKeys.length > 0) {
          rewritten.push(inlinedParent);
        }
      }

      if (rewritten.length === 0) {
        delete (variantSchema as Record<string, unknown>).allOf;
      } else {
        variantSchema.allOf = rewritten;
      }
    }
  }

  return transformedSchemas;
}
