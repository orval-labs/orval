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
      formatter: 'prettier',
      baseUrl: 'http://localhost:8000',
      mock: true,
    },
  },
  petstoreEffect: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'effect',
      target: 'src/gen/endpoints',
      fileExtension: '.effect.ts',
      formatter: 'prettier',
    },
  },
});
