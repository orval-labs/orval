import { SchemasObject } from 'openapi3-ts';
import { ContextSpecs } from '../types';
import { getRefInfo } from './ref';

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
          const { name } = getRefInfo(mappingValue, context);
          subTypeSchema = transformedSchemas[name];
        } catch (e) {
          subTypeSchema = transformedSchemas[mappingValue];
        }

        if (!subTypeSchema) {
          continue;
        }

        subTypeSchema.properties = {
          ...subTypeSchema.properties,
          [propertyName]: {
            type: 'string',
            enum: [mappingKey],
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
