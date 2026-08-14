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
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  // Pins that a caller is not asked for page params the config already writes
  // into the emitted literal, and that the query helpers keep their optional
  // props when the trailing `options` parameter is itself optional.
  queryHelpers: {
    output: {
      target: '../generated/solid-query/query-helpers/endpoints.ts',
      schemas: '../generated/solid-query/query-helpers/model',
      client: 'solid-query',
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
          useInvalidate: true,
          options: {
            initialPageParam: '',
            getNextPageParam: () => undefined,
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Pins that only the signatures ending in a mandatory `options` parameter get
  // their preceding optional props widened. The invalidate helper's trailing
  // `options?` is optional, so its props must stay optional.
  infiniteInvalidate: {
    output: {
      target: '../generated/solid-query/infinite-invalidate/endpoints.ts',
      schemas: '../generated/solid-query/infinite-invalidate/model',
      client: 'solid-query',
      allParamsOptional: true,
      override: {
        query: {
          useInfinite: true,
          useInfiniteQueryParam: 'page',
          useInvalidate: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-1522.yaml',
    },
  },
  // Solid Query ships no suspense hooks, so these must map to the plain ones.
  suspense: {
    output: {
      target: '../generated/solid-query/suspense/endpoints.ts',
      schemas: '../generated/solid-query/suspense/model',
      client: 'solid-query',
      override: {
        query: {
          useSuspenseQuery: true,
          useSuspenseInfiniteQuery: true,
          useInfiniteQueryParam: 'limit',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Without an explicit page param the queryFn and the options interface must
  // still agree on TPageParam, which no cast is laundering here.
  infiniteNoQueryParam: {
    output: {
      target: '../generated/solid-query/infinite-no-query-param/endpoints.ts',
      schemas: '../generated/solid-query/infinite-no-query-param/model',
      client: 'solid-query',
      override: {
        query: {
          useInfinite: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
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
      formatter: 'prettier',
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
      formatter: 'prettier',
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
      formatter: 'prettier',
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
      formatter: 'prettier',
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
      formatter: 'prettier',
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
      formatter: 'prettier',
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
      formatter: 'prettier',
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
      formatter: 'prettier',
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
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
});
