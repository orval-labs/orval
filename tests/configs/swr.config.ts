import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/swr/petstore/endpoints.ts',
      schemas: '../generated/swr/petstore/model',
      client: 'swr',
      mock: true,
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
      target: '../generated/swr/petstore-tags-split/endpoints.ts',
      schemas: '../generated/swr/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'swr',
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
      httpClient: 'fetch',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetchWithIncludeHttpStatusReturnType: {
    output: {
      target:
        '../generated/swr/http-client-fetch-with-include-http_status_return-type/endpoints.ts',
      schemas:
        '../generated/swr/http-client-fetch-with-include-http_status_return-type/model',
      mode: 'tags-split',
      client: 'swr',
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
      target: '../generated/swr/mutator/endpoints.ts',
      schemas: '../generated/swr/mutator/model',
      client: 'swr',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/multi-arguments.ts',
          name: 'customInstance',
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
  customClient: {
    output: {
      target: '../generated/swr/custom-client/endpoints.ts',
      schemas: '../generated/swr/custom-client/model',
      client: 'swr',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-client.ts',
          name: 'customClient',
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
        '../generated/swr/http-client-fetch-with-custom-fetch/endpoints.ts',
      schemas: '../generated/swr/http-client-fetch-with-custom-fetch/model',
      client: 'swr',
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
  namedParameters: {
    output: {
      target: '../generated/swr/named-parameters/endpoints.ts',
      schemas: '../generated/swr/named-parameters/model',
      client: 'swr',
      override: {
        useNamedParameters: true,
      },
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
          swrOptions: {
            dedupingInterval: 10000,
          },
          swrMutationOptions: {
            revalidate: true,
          },
          swrInfiniteOptions: {
            initialSize: 10,
          },
        },
      },
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
    },
    input: {
      target: '../specifications/arrays.yaml',
    },
  },
  enums: {
    output: {
      target: '../generated/swr/enums/endpoints.ts',
      schemas: '../generated/swr/enums/model',
      client: 'swr',
      mock: true,
    },
    input: {
      target: '../specifications/enums.yaml',
    },
  },
  errors: {
    output: {
      target: '../generated/swr/errors/endpoints.ts',
      schemas: '../generated/swr/errors/model',
      client: 'swr',
      mock: true,
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
    },
    input: {
      target: '../specifications/examples.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
});
