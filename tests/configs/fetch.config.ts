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
        fetch: {
          forceSuccessResponse: true,
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
          includeHttpResponseReturnType: false,
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
  headers: {
    output: {
      target: '../generated/fetch/headers/endpoints.ts',
      schemas: '../generated/fetch/headers/model',
      client: 'fetch',
      headers: true,
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
  importFromSubdirectory: {
    output: {
      target: '../generated/fetch/importFromSubdirectory/endpoints.ts',
      schemas: '../generated/fetch/importFromSubdirectory/model',
      client: 'fetch',
    },
    input: '../specifications/import-from-subdirectory/petstore.yaml',
  },
  defaultOnlyResponse: {
    output: {
      target: '../generated/fetch/default-only-response/endpoints.ts',
      client: 'fetch',
    },
    input: '../specifications/default-response.yaml',
  },
  emptyResponse: {
    output: {
      target: '../generated/fetch/empty-response/endpoints.ts',
      schemas: '../generated/fetch/empty-response/model',
      client: 'fetch',
    },
    input: {
      target: '../specifications/empty-response.yaml',
    },
  },
  stream: {
    output: {
      target: '../generated/fetch/stream/endpoints.ts',
      schemas: '../generated/fetch/stream/model',
      client: 'fetch',
    },
    input: {
      target: '../specifications/stream.yaml',
    },
  },
  reviver: {
    output: {
      target: '../generated/fetch/reviver/endpoints.ts',
      schemas: '../generated/fetch/reviver/model',
      client: 'fetch',
      mode: 'tags-split',
      override: {
        fetch: {
          jsonReviver: {
            path: 'mutators/custom-reviver.ts',
            default: true,
          },
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  dateParams: {
    output: {
      target: '../generated/fetch/dateParams/endpoints.ts',
      schemas: '../generated/fetch/dateParams/model',
      client: 'fetch',
      urlEncodeParameters: true,
      mode: 'tags-split',
      override: {
        useDates: true,
      },
    },
    input: {
      target: '../specifications/parameters.yaml',
    },
  },
  forceSuccessResponse: {
    output: {
      target: '../generated/fetch/force-success-response/endpoints.ts',
      schemas: '../generated/fetch/force-success-response/model',
      client: 'fetch',
      override: {
        fetch: {
          forceSuccessResponse: true,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  requestOptionsHeaders: {
    output: {
      target: '../generated/fetch/request-options-headers/endpoints.ts',
      schemas: '../generated/fetch/request-options-headers/model',
      client: 'fetch',
      override: {
        requestOptions: {
          headers: {
            Authorization: "Bearer ${process.env.API_TOKEN || ''}",
            'X-Static-Header': 'static-value',
          },
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
});
