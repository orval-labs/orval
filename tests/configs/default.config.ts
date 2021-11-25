import { defineConfig } from 'orval';
import transformer from '../transformers/add-version.js';

export default defineConfig({
  petstore: {
    input: '../specifications/petstore.yaml',
    output: '../generated/default/petstore/endpoints.ts',
  },
  'petstore-transfomer': {
    output: {
      target: '../generated/default/petstore-transformer/endpoints.ts',
      schemas: '../generated/default/petstore-transformer/model',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer,
      },
    },
  },
  'petstore-tslint': {
    input: '../specifications/petstore.yaml',
    output: {
      target: '../generated/default/petstore-tslint/endpoints.ts',
      schemas: '../generated/default/petstore-tslint/model',
      tslint: true
    },
  },
});
