import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/fetch/petstore/endpoints.ts',
      schemas: '../generated/fetch/petstore/model',
      mock: true,
      client: 'fetch',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mutator: {
    output: {
      target: '../generated/fetch/mutator/endpoints.ts',
      schemas: '../generated/fetch/mutator/model',
      mock: true,
      client: 'fetch',
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
  multiArguments: {
    output: {
      target: '../generated/fetch/multi-arguments/endpoints.ts',
      schemas: '../generated/fetch/multi-arguments/model',
      mock: true,
      client: 'fetch',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/fetch/petstore-tags-split/endpoints.ts',
      schemas: '../generated/fetch/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'fetch',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/fetch/split/endpoints.ts',
      schemas: '../generated/fetch/split/model',
      mock: true,
      mode: 'split',
      client: 'fetch',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/fetch/tags/endpoints.ts',
      schemas: '../generated/fetch/tags/model',
      mock: true,
      mode: 'tags',
      client: 'fetch',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  includeHttpStatusReturnType: {
    output: {
      target: '../generated/fetch/include-http-status-return-type/endpoints.ts',
      schemas: '../generated/fetch/include-http-status-return-type/model',
      mock: true,
      client: 'fetch',
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
  namedParameters: {
    output: {
      target: '../generated/fetch/named-parameters/endpoints.ts',
      schemas: '../generated/fetch/named-parameters/model',
      client: 'fetch',
      override: {
        useNamedParameters: true,
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  formData: {
    output: {
      target: '../generated/fetch/form-data-optional-request/endpoints.ts',
      schemas: '../generated/fetch/form-data-optional-request/model',
      client: 'fetch',
      mock: true,
    },
    input: {
      target: '../specifications/form-data-optional-request.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  formDataWithCustomFetch: {
    output: {
      target: '../generated/fetch/form-data-with-custom-fetch/endpoints.ts',
      schemas: '../generated/fetch/form-data-with-custom-fetch/model',
      client: 'fetch',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
    input: {
      target: '../specifications/form-data-optional-request.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  formUrlEncoded: {
    output: {
      target: '../generated/fetch/form-url-encoded/endpoints.ts',
      schemas: '../generated/fetch/form-url-encoded/model',
      client: 'fetch',
      mock: true,
    },
    input: {
      target: '../specifications/form-url-encoded.yaml',
    },
  },
  formUrlEncodedCustomFetch: {
    output: {
      target:
        '../generated/fetch/form-url-encoded-with-custom-fetch/endpoints.ts',
      schemas: '../generated/fetch/form-url-encoded-with-custom-fetch/model',
      client: 'fetch',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
    input: {
      target: '../specifications/form-url-encoded.yaml',
    },
  },
  parameters: {
    output: {
      target: '../generated/fetch/parameters/endpoints.ts',
      schemas: '../generated/fetch/parameters/model',
      client: 'fetch',
    },
    input: {
      target: '../specifications/parameters.yaml',
    },
  },
});
