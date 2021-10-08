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
});
