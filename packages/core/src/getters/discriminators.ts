import { isArray, isBoolean } from 'remeda';

import type { ContextSpec, OpenApiSchemasObject } from '../types';
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

        if (isBoolean(subTypeSchema) || propertyName === undefined) {
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

        const mergedEnumValues = (enumValues ?? [])
          .filter((value) => value !== mappingKey)
          .concat(mappingKey);

        const mergedProperty = {
          ...schemaProperty,
          type: 'string',
          enum: mergedEnumValues,
        };

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

  return transformedSchemas;
}
