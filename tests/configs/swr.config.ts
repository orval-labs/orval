import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/swr/petstore/endpoints.ts',
      schemas: '../generated/swr/petstore/model',
      client: 'swr',
      mock: true,
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
      target: '../generated/swr/zod-schema-response/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/swr/zod-schema-response/model',
      },
      mock: true,
      client: 'swr',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/swr/petstore-tags-split/endpoints.ts',
      schemas: '../generated/swr/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'swr',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/swr/split/endpoints.ts',
      schemas: '../generated/swr/split/model',
      mock: true,
      mode: 'split',
      client: 'swr',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/swr/tags/endpoints.ts',
      schemas: '../generated/swr/tags/model',
      mock: true,
      mode: 'tags',
      client: 'swr',
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetch: {
    output: {
      target: '../generated/swr/http-client-fetch/endpoints.ts',
      schemas: '../generated/swr/http-client-fetch/model',
      mode: 'tags-split',
      client: 'swr',
      override: {
        fetch: {
          forceSuccessResponse: true,
        },
      },
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
        '../generated/swr/http-client-fetch-with-include-http_status_return-type/endpoints.ts',
      schemas:
        '../generated/swr/http-client-fetch-with-include-http_status_return-type/model',
      mode: 'tags-split',
      client: 'swr',
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
      target: '../generated/swr/mutator/endpoints.ts',
      schemas: '../generated/swr/mutator/model',
      client: 'swr',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/multi-arguments.ts',
          name: 'customInstance',
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
  customClient: {
    output: {
      target: '../generated/swr/custom-client/endpoints.ts',
      schemas: '../generated/swr/custom-client/model',
      client: 'swr',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-client.ts',
          name: 'customClient',
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
        '../generated/swr/http-client-fetch-with-custom-fetch/endpoints.ts',
      schemas: '../generated/swr/http-client-fetch-with-custom-fetch/model',
      client: 'swr',
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
      target: '../generated/swr/named-parameters/endpoints.ts',
      schemas: '../generated/swr/named-parameters/model',
      client: 'swr',
      override: {
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
  petstoreOverrideSwr: {
    output: {
      target: '../generated/swr/petstore-override-swr/endpoints.ts',
      schemas: '../generated/swr/petstore-override-swr/model',
      client: 'swr',
      override: {
        swr: {
          useInfinite: true,
          useSWRMutationForGet: true,
          swrOptions: {
            dedupingInterval: 10_000,
          },
          swrMutationOptions: {
            revalidate: true,
          },
          swrInfiniteOptions: {
            initialSize: 10,
          },
        },
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreWithHeaders: {
    output: {
      target: '../generated/swr/petstore-with-headers/endpoints.ts',
      schemas: '../generated/swr/petstore-with-headers/model',
      client: 'swr',
      headers: true,
      override: {
        swr: {
          useInfinite: true,
        },
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  blobFile: {
    output: {
      target: '../generated/swr/blob-file/endpoints.ts',
      schemas: '../generated/swr/blob-file/model',
      client: 'swr',
      mock: true,
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/blob-file.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  nestedArrays: {
    output: {
      target: '../generated/swr/nested-arrays/endpoints.ts',
      schemas: '../generated/swr/nested-arrays/model',
      client: 'swr',
      mock: true,
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/arrays.yaml',
    },
  },
  errors: {
    output: {
      target: '../generated/swr/errors/endpoints.ts',
      schemas: '../generated/swr/errors/model',
      client: 'swr',
      mock: true,
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/errors.yaml',
    },
  },
  optionalRequestBody: {
    output: {
      target: '../generated/swr/optional-request-body/endpoints.ts',
      schemas: '../generated/swr/optional-request-body/model',
      client: 'swr',
      mock: true,
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/optional-request-body.yaml',
    },
  },
  pattern: {
    output: {
      target: '../generated/swr/pattern/endpoints.ts',
      schemas: '../generated/swr/pattern/model',
      client: 'swr',
      mock: true,
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/pattern.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  formData: {
    output: {
      target: '../generated/swr/form-data-optional-request/endpoints.ts',
      schemas: '../generated/swr/form-data-optional-request/model',
      client: 'swr',
      mock: true,
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/form-data-optional-request.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  examples: {
    output: {
      target: '../generated/swr/examples/endpoints.ts',
      schemas: '../generated/swr/examples/model',
      client: 'swr',
      mock: {
        generateEachHttpStatus: true,
        type: 'msw',
        useExamples: true,
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/examples.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  baseUrlFromSpec: {
    output: {
      target: '../generated/swr/baseUrlFromSpec/endpoints.ts',
      schemas: '../generated/swr/baseUrlFromSpec/model',
      client: 'swr',
      baseUrl: {
        getBaseUrlFromSpecification: true,
        variables: {
          environment: 'api.dev',
        },
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/url-paths.yaml',
    },
  },
  baseUrlNotFromSpec: {
    output: {
      target: '../generated/swr/baseUrlNotFromSpec/endpoints.ts',
      schemas: '../generated/swr/baseUrlNotFromSpec/model',
      client: 'swr',
      baseUrl: {
        getBaseUrlFromSpecification: false,
        baseUrl: 'https://api.example.com',
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/url-paths.yaml',
    },
  },
  swrInfinitePagination: {
    output: {
      target: '../generated/swr/swr-infinite-pagination/endpoints.ts',
      schemas: '../generated/swr/swr-infinite-pagination/model',
      client: 'swr',
      override: {
        swr: {
          useInfinite: true,
        },
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/swr-infinite-pagination.yaml',
    },
  },
  swrSuspense: {
    output: {
      target: '../generated/swr/swr-suspense/endpoints.ts',
      schemas: '../generated/swr/swr-suspense/model',
      client: 'swr',
      override: {
        swr: {
          useSuspense: true,
        },
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  swrWithErrorTypes: {
    output: {
      target: '../generated/swr/swr-with-error-types/endpoints.ts',
      schemas: '../generated/swr/swr-with-error-types/model',
      client: 'swr',
      override: {
        swr: {
          generateErrorTypes: true,
        },
      },
      clean: true,
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
});
