import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/gen/petstore.ts',
      schemas: 'src/gen/models',
      client: 'svelte-query',
      baseUrl: 'http://localhost:8000',
      mock: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/custom-fetch.ts',
          name: 'customFetch',
        },
        query: {
          usePrefetch: true,
          mutationInvalidates: [
            {
              onMutations: ['createPets'],
              invalidates: ['listPets'],
            },
          ],
        },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
