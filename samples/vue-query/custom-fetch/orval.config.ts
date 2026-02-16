import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/gen/petstore.ts',
      schemas: 'src/gen/models',
      client: 'vue-query',
      baseUrl: 'http://localhost:8000',
      mock: true,
      clean: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
