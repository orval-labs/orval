import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: './endpoints.ts',
      schemas: './models',
      client: 'react-query',
      httpClient: 'axios',
      prettier: true,
      override: {
        mutator: {
          path: './custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
