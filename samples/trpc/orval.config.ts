import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'split',
      target: 'client/src/api/endpoints/petstore.ts',
      client: 'trpc',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: './client/src/api/transformer/add-version.js',
      },
    },
  },
});
