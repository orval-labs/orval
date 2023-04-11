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
      target: '../generated/default/endpoint-parameters/endpoints.ts',
      schemas: '../generated/default/endpoint-parameters/model',
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
  regressions: {
    input: '../specifications/regressions.yaml',
    output: {
      target: '../generated/default/regressions/endpoints.ts',
      schemas: '../generated/default/regressions/model',
      mode: 'tags-split',
    },
  },
  'null-type': {
    input: '../specifications/null-type.yaml',
    output: {
      schemas: '../generated/default/null-type/model',
      target: '../generated/default/null-type/endpoints.ts',
    },
  },
  readonly: {
    input: '../specifications/readonly.yaml',
    output: {
      schemas: '../generated/default/readonly/model',
      target: '../generated/default/readonly/endpoints.ts',
    },
  },
});
