import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/zod/petstore/endpoints.ts',
      schemas: '../generated/zod/petstore/model',
      client: 'zod',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  tagsSplit: {
    output: {
      target: '../generated/zod/tags-split/endpoints.ts',
      schemas: '../generated/zod/tags-split/model',
      client: 'zod',
      mode: 'tags-split',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  customClient: {
    output: {
      target: '../generated/zod/custom-client/endpoints.ts',
      schemas: '../generated/zod/custom-client/model',
      client: 'zod',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
});
