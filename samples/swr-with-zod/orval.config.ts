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
  petstoreZod: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'zod',
      target: 'src/gen/endpoints',
      fileExtension: '.zod.ts',
      formatter: 'prettier',
    },
  },
  petstoreZodReusable: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'zod',
      target: 'src/gen/endpoints',
      schemas: 'src/gen/models',
      fileExtension: '-reusable.zod.ts',
      formatter: 'prettier',
      override: {
        zod: {
          generateReusableSchemas: true,
        },
      },
    },
  },
});
