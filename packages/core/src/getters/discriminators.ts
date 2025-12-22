import type { ContextSpec, OpenApiSchemasObject } from '../types';
import { pascal } from '../utils';
import { getRefInfo } from './ref';

export function resolveDiscriminators(
  schemas: OpenApiSchemasObject,
  context: ContextSpec,
): OpenApiSchemasObject {
  const transformedSchemas = schemas;
  for (const schema of Object.values(transformedSchemas)) {
    if (typeof schema === 'boolean') {
      continue; // skip boolean schemas as we can't do anything meaningful with them
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

        if (typeof subTypeSchema === 'boolean' || propertyName === undefined) {
          continue;
        }

        const property = subTypeSchema.properties?.[propertyName];
        if (typeof property === 'boolean' || property === undefined) {
          continue;
        }

        subTypeSchema.properties = {
          ...subTypeSchema.properties,
          [propertyName]: {
            type: 'string',
            enum: [
              ...(property?.enum?.filter((value) => value !== mappingKey) ??
                []),
              mappingKey,
            ],
          },
        };
        subTypeSchema.required = [
          ...(subTypeSchema.required ?? []),
          propertyName,
        ];
      }
    }
  }

  return transformedSchemas;
}
