import { type OpenApiSchemaObject, defineConfig } from 'orval';

/** A non-boolean schema carrying the vendor extension this sample validates. */
type DecimalSchemaObject = Exclude<OpenApiSchemaObject, boolean> & {
  'x-max-precision'?: number;
};

export default defineConfig({
  petstore: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      client: 'zod',
      mode: 'single',
      target: './schemas',
      override: {
        zod: {
          // Prefer Mini for more tree-shakeable generated schemas.
          variant: 'mini',
          version: 4,
          schemaExtension: [
            {
              type: 'string',
              format: 'decimal',
              validatorsGenerator: (openapi_object: DecimalSchemaObject) => {
                const maxPrecision = openapi_object['x-max-precision'];
                if (maxPrecision) {
                  return {
                    callable: (value: unknown) => {
                      if (
                        typeof value !== 'string' ||
                        !/^[+-]?(?:\d+(\.\d*)?|\.\d+)$/.test(value)
                      ) {
                        return false;
                      }

                      const precision = value.split('.')[1]?.length ?? 0;

                      return precision === 0 || precision <= maxPrecision;
                    },
                    bindings: { maxPrecision },
                  };
                }
                return null;
              },
            },
          ],
        },
      },
      formatter: 'prettier',
      clean: true,
    },
  },
});
