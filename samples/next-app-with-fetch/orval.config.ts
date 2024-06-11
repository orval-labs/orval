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
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
