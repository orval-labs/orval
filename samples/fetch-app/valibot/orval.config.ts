import { defineConfig } from 'orval';

export default defineConfig({
  // The generated client validates responses with the Valibot schemas.
  validated: {
    input: './petstore.yaml',
    output: {
      client: 'fetch',
      mode: 'single',
      target: './src/api/validated/endpoints.ts',
      schemas: { path: './src/api/validated/schemas.ts', type: 'valibot' },
      baseUrl: 'http://localhost:3000',
      clean: true,
      formatter: 'prettier',
      override: { fetch: { runtimeValidation: true } },
    },
  },
  // A mutator receives the schema and validates the response itself.
  mutator: {
    input: './petstore.yaml',
    output: {
      client: 'fetch',
      mode: 'single',
      target: './src/api/mutator/endpoints.ts',
      schemas: { path: './src/api/mutator/schemas.ts', type: 'valibot' },
      baseUrl: 'http://localhost:3000',
      clean: true,
      formatter: 'prettier',
      override: {
        fetch: { runtimeValidation: true },
        includeSchemaInArguments: true,
        mutator: {
          path: './src/mutator/standard-schema-fetch.ts',
          name: 'standardSchemaFetch',
        },
      },
    },
  },
});
