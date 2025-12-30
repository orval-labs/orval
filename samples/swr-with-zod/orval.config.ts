import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'swr',
      target: 'src/gen/endpoints',
      schemas: 'src/gen/models',
      clean: true,
      baseUrl: 'http://localhost:8000',
      mock: true,
    },
  },
  petstoreZod: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'zod',
      target: 'src/gen/endpoints',
      fileExtension: '.zod.ts',
    },
  },
});
