import { defineConfig } from 'orval';
import transformer from '../transformers/add-version.js';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/axios/petstore/endpoints.ts',
      schemas: '../generated/axios/petstore/model',
      mock: true,
      client: 'axios',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer,
      },
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/axios/petstore-tags-split/endpoints.ts',
      schemas: '../generated/axios/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'axios',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer,
      },
    },
  },
});
