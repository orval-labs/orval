import { defineTransformer } from 'orval';

// Inject a NEW external $ref (refs.yaml#/...) that is absent from the source
// spec. Because the transformer runs after the initial bundle, orval must
// re-bundle its output so the external file is resolved (#3327).
export default defineTransformer((inputSchema) => {
  const schemas = inputSchema.components?.schemas ?? {};
  const field = schemas.Field;
  const fieldObject =
    field && typeof field === 'object' && !Array.isArray(field) ? field : {};
  const properties =
    'properties' in fieldObject &&
    fieldObject.properties &&
    typeof fieldObject.properties === 'object' &&
    !Array.isArray(fieldObject.properties)
      ? fieldObject.properties
      : {};

  return {
    ...inputSchema,
    components: {
      ...inputSchema.components,
      schemas: {
        ...schemas,
        Field: {
          ...fieldObject,
          properties: {
            ...properties,
            geometry: {
              oneOf: [
                { $ref: 'refs.yaml#/components/schemas/Point' },
                { $ref: 'refs.yaml#/components/schemas/LineString' },
              ],
            },
          },
        },
      },
    },
  };
});
