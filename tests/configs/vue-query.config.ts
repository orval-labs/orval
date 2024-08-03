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
  petstoreTagsSplit: {
    output: {
      target: '../generated/vue-query/petstore-tags-split/endpoints.ts',
      schemas: '../generated/vue-query/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'vue-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/vue-query/split/endpoints.ts',
      schemas: '../generated/vue-query/split/model',
      mock: true,
      mode: 'split',
      client: 'vue-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/vue-query/tags/endpoints.ts',
      schemas: '../generated/vue-query/tags/model',
      mock: true,
      mode: 'tags',
      client: 'vue-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetch: {
    output: {
      target: '../generated/vue-query/http-client-fetch/endpoints.ts',
      schemas: '../generated/vue-query/http-client-fetch/model',
      mode: 'tags-split',
      client: 'vue-query',
      httpClient: 'fetch',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetchWithIncludeHttpStatusReturnType: {
    output: {
      target:
        '../generated/vue-query/http-client-fetch-with-include-http-status-return-type/endpoints.ts',
      schemas:
        '../generated/vue-query/http-client-fetch-with-include-http-status-return-type/model',
      mode: 'tags-split',
      client: 'vue-query',
      httpClient: 'fetch',
      override: {
        fetch: {
          includeHttpStatusReturnType: false,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
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
  httpClientFetchWithCustomFetch: {
    output: {
      target:
        '../generated/vue-query/http-client-fetch-with-custom-fetch/endpoints.ts',
      schemas:
        '../generated/vue-query/http-client-fetch-with-custom-fetch/model',
      client: 'vue-query',
      httpClient: 'fetch',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
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
  // Unsupported for now, see for context: https://github.com/orval-labs/orval/pull/931#issuecomment-1752355686
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
