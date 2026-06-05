import { defineTransformer } from 'orval';

// Inject a NEW external $ref (refs.yaml#/...) that is absent from the source
// spec. Because the transformer runs after the initial bundle, orval must
// re-bundle its output so the external file is resolved (#3327).
export default defineTransformer((inputSchema) => ({
  ...inputSchema,
  components: {
    ...inputSchema.components,
    schemas: {
      ...inputSchema.components.schemas,
      Field: {
        ...inputSchema.components.schemas.Field,
        properties: {
          ...inputSchema.components.schemas.Field.properties,
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
}));
