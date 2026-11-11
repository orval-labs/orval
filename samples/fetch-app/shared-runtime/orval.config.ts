import { defineConfig } from 'orval';

// Both outputs import `execute` from the same `src/api/runtime.ts`, which sits
// outside their `clean` targets.
const fetch = {
  runtimeImplementationStyle: 'shared',
  runtimeOutputPath: './src/api/runtime.ts',
} as const;

export default defineConfig({
  petstore: {
    input: './specs/petstore.yaml',
    output: {
      mode: 'tags-split',
      target: './src/api/petstore/endpoints.ts',
      schemas: './src/api/petstore/model',
      client: 'fetch',
      baseUrl: 'http://localhost:3000',
      mock: true,
      clean: true,
      formatter: 'prettier',
      override: { fetch },
    },
  },
  store: {
    input: './specs/store.yaml',
    output: {
      mode: 'tags-split',
      target: './src/api/store/endpoints.ts',
      schemas: './src/api/store/model',
      client: 'fetch',
      baseUrl: 'http://localhost:3000',
      mock: true,
      clean: true,
      formatter: 'prettier',
      override: {
        fetch,
        mutator: { path: './src/custom-fetch.ts', name: 'customFetch' },
      },
    },
  },
});
