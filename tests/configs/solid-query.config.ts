import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/solid-query/petstore/endpoints.ts',
      schemas: '../generated/solid-query/petstore/model',
      client: 'solid-query',
      mock: true,
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
      },
      clean: true,
      prettier: true,
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
      target: '../generated/solid-query/zod-schema-response/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/solid-query/zod-schema-response/model',
      },
      mock: true,
      client: 'solid-query',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/solid-query/petstore-tags-split/endpoints.ts',
      schemas: '../generated/solid-query/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'solid-query',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/solid-query/split/endpoints.ts',
      schemas: '../generated/solid-query/split/model',
      mock: true,
      mode: 'split',
      client: 'solid-query',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/solid-query/tags/endpoints.ts',
      schemas: '../generated/solid-query/tags/model',
      mock: true,
      mode: 'tags',
      client: 'solid-query',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetch: {
    output: {
      target: '../generated/solid-query/http-client-fetch/endpoints.ts',
      schemas: '../generated/solid-query/http-client-fetch/model',
      mode: 'tags-split',
      client: 'solid-query',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetchWithIncludeHttpResponseReturnType: {
    output: {
      target:
        '../generated/solid-query/http-client-fetch-with-include-http-response-return-type/endpoints.ts',
      schemas:
        '../generated/solid-query/http-client-fetch-with-include-http-response-return-type/model',
      mode: 'tags-split',
      client: 'solid-query',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mutator: {
    output: {
      target: '../generated/solid-query/mutator/endpoints.ts',
      schemas: '../generated/solid-query/mutator/model',
      client: 'solid-query',
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
      prettier: true,
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
        '../generated/solid-query/http-client-fetch-with-custom-fetch/endpoints.ts',
      schemas:
        '../generated/solid-query/http-client-fetch-with-custom-fetch/model',
      client: 'solid-query',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-fetch.ts',
          name: 'customFetch',
        },
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  namedParameters: {
    output: {
      target: '../generated/solid-query/named-parameters/endpoints.ts',
      schemas: '../generated/solid-query/named-parameters/model',
      client: 'solid-query',
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
        useNamedParameters: true,
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
});
