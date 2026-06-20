import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/vue-query/petstore/endpoints.ts',
      schemas: '../generated/vue-query/petstore/model',
      client: 'vue-query',
      httpClient: 'axios',
      mock: true,
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  zodSchemaResponse: {
    output: {
      target: '../generated/vue-query/zod-schema-response/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/vue-query/zod-schema-response/model',
      },
      mock: true,
      client: 'vue-query',
      httpClient: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/vue-query/petstore-tags-split/endpoints.ts',
      schemas: '../generated/vue-query/petstore-tags-split/model',
      httpClient: 'axios',
      mock: true,
      mode: 'tags-split',
      client: 'vue-query',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/vue-query/split/endpoints.ts',
      schemas: '../generated/vue-query/split/model',
      httpClient: 'axios',
      mock: true,
      mode: 'split',
      client: 'vue-query',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/vue-query/tags/endpoints.ts',
      schemas: '../generated/vue-query/tags/model',
      httpClient: 'axios',
      mock: true,
      mode: 'tags',
      client: 'vue-query',
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetchWithIncludeHttpResponseReturnType: {
    output: {
      target:
        '../generated/vue-query/http-client-fetch-with-include-http-response-return-type/endpoints.ts',
      schemas:
        '../generated/vue-query/http-client-fetch-with-include-http-response-return-type/model',
      mode: 'tags-split',
      client: 'vue-query',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
      clean: true,
      formatter: 'prettier',
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
      httpClient: 'axios',
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
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  hookMutator: {
    output: {
      target: '../generated/vue-query/hook-mutator/endpoints.ts',
      schemas: '../generated/vue-query/hook-mutator/model',
      client: 'vue-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance-vue.ts',
          name: 'useCustomInstance',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/vue-query-hook-mutator.yaml',
    },
  },
  httpClientFetchWithCustomFetch: {
    output: {
      target:
        '../generated/vue-query/http-client-fetch-with-custom-fetch/endpoints.ts',
      schemas:
        '../generated/vue-query/http-client-fetch-with-custom-fetch/model',
      client: 'vue-query',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-fetch.ts',
          name: 'customFetch',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  infiniteQueryWithCustomFetch: {
    output: {
      target:
        '../generated/vue-query/infinite-query-with-custom-fetch/endpoints.ts',
      schemas: '../generated/vue-query/infinite-query-with-custom-fetch/model',
      client: 'vue-query',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-fetch.ts',
          name: 'customFetch',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/multi-query-params.yaml',
    },
  },
  infiniteQueryWithBuiltInFetch: {
    output: {
      target:
        '../generated/vue-query/infinite-query-with-built-in-fetch/endpoints.ts',
      schemas:
        '../generated/vue-query/infinite-query-with-built-in-fetch/model',
      client: 'vue-query',
      mock: true,
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/multi-query-params.yaml',
    },
  },
  allParamsOptional: {
    output: {
      target: '../generated/vue-query/all-params-optional/endpoints.ts',
      schemas: '../generated/vue-query/all-params-optional/model',
      client: 'vue-query',
      mock: true,
      allParamsOptional: true,
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetchWithMultiQueryParams: {
    output: {
      target:
        '../generated/vue-query/http-client-fetch-with-multi-query-params/endpoints.ts',
      schemas:
        '../generated/vue-query/http-client-fetch-with-multi-query-params/model',
      client: 'vue-query',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/multi-query-params.yaml',
    },
  },
  formData: {
    output: {
      target: '../generated/vue-query/form-data/endpoints.ts',
      schemas: '../generated/vue-query/form-data/model',
      client: 'vue-query',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/form-data.yaml',
    },
  },
  useSetQueryData: {
    output: {
      target: '../generated/vue-query/use-set-query-data/endpoints.ts',
      schemas: '../generated/vue-query/use-set-query-data/model',
      client: 'vue-query',
      override: { query: { useSetQueryData: true } },
      clean: true,
      formatter: 'prettier',
    },
    input: { target: '../specifications/petstore.yaml' },
  },
  issue1026: {
    output: {
      target: '../generated/vue-query/issue-1026/endpoints.ts',
      schemas: '../generated/vue-query/issue-1026/model',
      client: 'vue-query',
      httpClient: 'axios',
      mode: 'split',
      headers: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-1026.yaml',
    },
  },
  invalidates: {
    output: {
      target: '../generated/vue-query/invalidates/endpoints.ts',
      schemas: '../generated/vue-query/invalidates/model',
      client: 'vue-query',
      mock: true,
      headers: true,
      override: {
        query: {
          mutationInvalidates: [
            {
              onMutations: ['createPets'],
              invalidates: ['listPets'],
            },
            {
              onMutations: ['deletePetById'],
              invalidates: [
                { query: 'listPets', invalidateMode: 'reset' },
                {
                  query: 'showPetById',
                  params: ['petId'],
                  invalidateMode: 'reset',
                },
              ],
            },
          ],
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  invalidatesOtherFile: {
    output: {
      target: '../generated/vue-query/invalidates-other-file',
      schemas: '../generated/vue-query/invalidates-other-file/model',
      client: 'vue-query',
      mode: 'tags',
      mock: true,
      headers: true,
      override: {
        query: {
          mutationInvalidates: [
            {
              onMutations: ['createPets'],
              invalidates: [
                'listPets',
                { query: 'healthCheck', file: './health' },
              ],
            },
            {
              onMutations: ['deletePetById'],
              invalidates: [
                { query: 'listPets', invalidateMode: 'reset' },
                { query: 'healthCheck', file: './health' },
                {
                  query: 'showPetById',
                  params: ['petId'],
                  invalidateMode: 'reset',
                },
              ],
            },
          ],
        },
      },
      clean: true,
      formatter: 'prettier',
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
