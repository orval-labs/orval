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
      tslint: true,
    },
  },
  endpointParameters: {
    input: '../specifications/parameters.yaml',
    output: {
      target: '../generated/default/endpointParameters/endpoints.ts',
      schemas: '../generated/default/endpointParameters/model',
      mock: true,
    },
  },
  translation: {
    input: '../specifications/translation.yaml',
    output: {
      target: '../generated/default/translation/endpoints.ts',
      schemas: '../generated/default/translation/model',
    },
  },
});
