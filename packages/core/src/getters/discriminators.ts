import { SchemaObject, SchemasObject } from 'openapi3-ts/oas30';
import { ContextSpecs } from '../types';
import { getRefInfo } from './ref';
import { pascal } from '../utils';

export const resolveDiscriminators = (
  schemas: SchemasObject,
  context: ContextSpecs,
): SchemasObject => {
  const transformedSchemas = { ...schemas };

  for (const schema of Object.values(transformedSchemas)) {
    if (schema.discriminator?.mapping) {
      const { mapping, propertyName } = schema.discriminator;

      for (const [mappingKey, mappingValue] of Object.entries(mapping)) {
        let subTypeSchema;

        try {
          const { originalName } = getRefInfo(mappingValue, context);
          // name from getRefInfo may contain a suffix, which we don't want
          const name = pascal(originalName);
          subTypeSchema = transformedSchemas[name];
        } catch (e) {
          subTypeSchema = transformedSchemas[mappingValue];
        }

        if (!subTypeSchema) {
          continue;
        }
        const property = subTypeSchema.properties?.[
          propertyName
        ] as SchemaObject;
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
};
