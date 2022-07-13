import { SchemasObject } from 'openapi3-ts';

export const resolveDiscriminators = (
  schemas: SchemasObject,
): SchemasObject => {
  const transformedSchemas = { ...schemas };

  for (const schema of Object.values(transformedSchemas)) {
    if (schema.discriminator?.mapping) {
      const { mapping, propertyName } = schema.discriminator;

      for (const mappingKey of Object.keys(mapping)) {
        const subTypeSchema = transformedSchemas[mappingKey];

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
