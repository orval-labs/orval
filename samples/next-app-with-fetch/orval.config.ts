import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'app/gen/petstore.ts',
      schemas: 'app/gen/models',
      client: 'fetch',
      baseUrl: 'http://localhost:3000',
      mock: true,
      prettier: true,
      override: {
        mutator: {
          path: './custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
