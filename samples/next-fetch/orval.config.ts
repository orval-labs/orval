import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'app/gen/petstore.ts',
      schemas: 'app/gen/models',
      client: 'fetch',
      mock: true,
      prettier: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
