import { defineConfig } from 'orval';
import transformer from '../transformers/add-version.js';

export default defineConfig({
  petstore: {
    input: '../specifications/petstore.yaml',
    output: '../generated/default/petstore/endpoints.ts',
  },
  'petstore-filter': {
    input: {
      target: '../specifications/petstore.yaml',
      filters: {
        tags: ['health'],
        schemas: ['Error', /Cat/],
      },
    },
    output: '../generated/default/petstore-filter/endpoints.ts',
  },
  'petstore-filter-exlude-mode': {
    input: {
      target: '../specifications/petstore.yaml',
      filters: {
        mode: 'exclude',
        tags: ['pets-nested-array'],
        schemas: ['PetsNestedArray'],
      },
    },
    output: '../generated/default/petstore-filter-exclude-mode/endpoints.ts',
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
  'null-type-v-3-0': {
    input: '../specifications/null-type-v3-0.yaml',
    output: {
      mock: true,
      schemas: '../generated/default/null-type-v3-0/model',
      target: '../generated/default/null-type-v3-0/endpoints.ts',
    },
  },
  readonly: {
    input: '../specifications/readonly.yaml',
    output: {
      schemas: '../generated/default/readonly/model',
      target: '../generated/default/readonly/endpoints.ts',
    },
  },
  'default-status': {
    input: '../specifications/default-status.yaml',
    output: {
      schemas: '../generated/default/default-status/model',
      target: '../generated/default/default-status/endpoints.ts',
    },
  },
  'all-of-one-of': {
    input: '../specifications/all-of-one-of.yaml',
    output: {
      schemas: '../generated/default/all-of-one-of/model',
      target: '../generated/default/all-of-one-of/endpoints.ts',
      mock: true,
    },
  },
  'all-of-primitive': {
    input: '../specifications/all-of-primitive.yaml',
    output: {
      schemas: '../generated/default/all-of-primitive/model',
      target: '../generated/default/all-of-primitive/endpoints.ts',
      mock: true,
    },
  },
  'one-of': {
    input: '../specifications/one-of.yaml',
    output: {
      schemas: '../generated/default/one-of/model',
      target: '../generated/default/one-of/endpoints.ts',
      mock: true,
    },
  },
  'one-of-primitive': {
    input: '../specifications/one-of-primitive.yaml',
    output: {
      schemas: '../generated/default/one-of-primitive/model',
      target: '../generated/default/one-of-primitive/endpoints.ts',
      mock: true,
    },
  },
  'any-of-primitive': {
    input: '../specifications/any-of-primitive.yaml',
    output: {
      schemas: '../generated/default/any-of-primitive/model',
      target: '../generated/default/any-of-primitive/endpoints.ts',
      mock: true,
    },
  },
  'circular-v2': {
    input: '../specifications/circular-v2.yaml',
    output: {
      schemas: '../generated/default/circular-v2/model',
      target: '../generated/default/circular-v2/endpoints.ts',
      mock: true,
    },
  },
  'any-of': {
    input: '../specifications/any-of.yaml',
    output: {
      schemas: '../generated/default/any-of/model',
      target: '../generated/default/any-of/endpoints.ts',
      mock: true,
    },
  },
  'all-of': {
    input: '../specifications/all-of.yaml',
    output: {
      schemas: '../generated/default/all-of/model',
      target: '../generated/default/all-of/endpoints.ts',
      mock: true,
    },
  },
  'all-of-ref': {
    input: '../specifications/all-of-ref.yaml',
    output: {
      schemas: '../generated/default/all-of-ref/model',
      target: '../generated/default/all-of-ref/endpoints.ts',
      mock: true,
    },
  },
  'deeply-nested-refs': {
    input: '../specifications/deeply-nested-refs.yaml',
    output: {
      schemas: '../generated/default/deeply-nested-refs/model',
      target: '../generated/default/deeply-nested-refs/endpoints.ts',
    },
  },
  'example-v3-1': {
    input: '../specifications/example-v3-1.yaml',
    output: {
      mock: true,
      schemas: '../generated/default/example-v3-1/model',
      target: '../generated/default/example-v3-1/endpoints.ts',
    },
  },
  'override-mock': {
    input: '../specifications/petstore.yaml',
    output: {
      mode: 'split',
      mock: true,
      schemas: '../generated/default/override-mock/model',
      target: '../generated/default/override-mock/endpoints.ts',
      override: {
        operations: {
          listPets: {
            mock: {
              data: () => {
                return {};
              },
            },
          },
        },
      },
    },
  },
  'runtime-mock-delay': {
    input: '../specifications/petstore.yaml',
    output: {
      mock: {
        delay: () => 400,
        delayFunctionLazyExecute: true,
        type: 'msw',
      },
      schemas: '../generated/default/runtime-mock-delay/model',
      target: '../generated/default/runtime-mock-delay/endpoints.ts',
    },
  },
  'http-status-mocks': {
    input: '../specifications/petstore.yaml',
    output: {
      mock: {
        generateEachHttpStatus: true,
        type: 'msw',
      },
      schemas: '../generated/default/http-status-mocks/model',
      target: '../generated/default/http-status-mocks/endpoints.ts',
    },
  },
  'combined-enum': {
    input: '../specifications/combined-enum.yaml',
    output: {
      schemas: '../generated/default/combine-enum/schemas',
      target: '../generated/default/combine-enum',
      mock: true,
    },
  },
  const: {
    input: '../specifications/const.yaml',
    output: {
      schemas: '../generated/default/const/model',
      target: '../generated/default/const',
      mock: true,
    },
  },
  noIndexFiles: {
    output: {
      target: '../generated/default/no-index-files/endpoints.ts',
      schemas: '../generated/default/no-index-files/model',
      client: 'fetch',
      indexFiles: false,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
});
