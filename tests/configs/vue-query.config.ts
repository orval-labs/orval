import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/vue-query/petstore/endpoints.ts',
      schemas: '../generated/vue-query/petstore/model',
      client: 'vue-query',
      mock: true,
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  mutator: {
    output: {
      target: '../generated/vue-query/mutator/endpoints.ts',
      schemas: '../generated/vue-query/mutator/model',
      client: 'vue-query',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  allParamsOptional: {
    output: {
      target: '../generated/vue-query/all-params-optional/endpoints.ts',
      schemas: '../generated/vue-query/all-params-optional/model',
      client: 'vue-query',
      mock: true,
      allParamsOptional: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  urlEncodeParameters: {
    output: {
      target: '../generated/vue-query/url-encode-parameters/endpoints.ts',
      schemas: '../generated/vue-query/url-encode-parameters/model',
      client: 'vue-query',
      mock: true,
      urlEncodeParameters: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  combinationUsedByMaximMazurok: {
    output: {
      target:
        '../generated/vue-query/combination-used-by-maxim-mazurok/endpoints.ts',
      schemas: '../generated/vue-query/combination-used-by-maxim-mazurok/model',
      client: 'vue-query',
      mock: true,
      allParamsOptional: true,
      urlEncodeParameters: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Unsupported for now, see for context: https://github.com/anymaniax/orval/pull/931#issuecomment-1752355686
  // namedParameters: {
  //   output: {
  //     target: '../generated/vue-query/named-parameters/endpoints.ts',
  //     schemas: '../generated/vue-query/named-parameters/model',
  //     client: 'vue-query',
  //     override: {
  //       query: {
  //         useQuery: true,
  //         useInfinite: true,
  //         useInfiniteQueryParam: 'limit',
  //       },
  //       useNamedParameters: true,
  //     },
  //   },
  //   input: {
  //     target: '../specifications/petstore.yaml',
  //     override: {
  //       transformer: '../transformers/add-version.js',
  //     },
  //   },
  // },
});
