import { defineConfig } from 'orval';

// Fixtures exercising the `runtimeValidation: { strategy: 'both' }` strategy
// (safeParse -> console.error -> throw) across every client that supports
// runtime validation. The `throw`/boolean path is covered by the existing
// per-client configs; these isolate the additive `both` output so its diff is
// reviewed independently.
export default defineConfig({
  logLevel: 'error',
  fetchBoth: {
    output: {
      target: '../generated/runtime-validation/fetch-both/endpoints.ts',
      schemas: {
        path: '../generated/runtime-validation/fetch-both/model',
        type: 'zod',
      },
      client: 'fetch',
      override: {
        fetch: {
          runtimeValidation: { strategy: 'both' },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  angularHttpClientBoth: {
    output: {
      target: '../generated/runtime-validation/angular-http-client-both/endpoints.ts',
      schemas: {
        path: '../generated/runtime-validation/angular-http-client-both/model',
        type: 'zod',
      },
      client: 'angular',
      override: {
        angular: {
          retrievalClient: 'httpClient',
          runtimeValidation: { strategy: 'both' },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  angularHttpResourceBoth: {
    output: {
      target: '../generated/runtime-validation/angular-http-resource-both/endpoints.ts',
      schemas: {
        path: '../generated/runtime-validation/angular-http-resource-both/model',
        type: 'zod',
      },
      client: 'angular',
      override: {
        angular: {
          retrievalClient: 'httpResource',
          runtimeValidation: { strategy: 'both' },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  angularQueryBoth: {
    output: {
      target: '../generated/runtime-validation/angular-query-both/endpoints.ts',
      schemas: {
        path: '../generated/runtime-validation/angular-query-both/model',
        type: 'zod',
      },
      client: 'angular-query',
      override: {
        query: {
          runtimeValidation: { strategy: 'both' },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // #4136/#4137: react-query and swr reuse the fetch request function but build
  // their own import list, so the `Schema.parse()` it emits landed next to an
  // `import type` and the `XOutput` alias naming the declared response type was
  // never imported. The spec covers the named-schema, inline-array, named-array
  // and primitive-array responses in one pass; `tests` typechecks everything
  // under `generated/`, which is what turns the TS1361 into a failing build.
  reactQueryFetchValidation: {
    output: {
      target:
        '../generated/runtime-validation/react-query-fetch/endpoints.ts',
      schemas: {
        path: '../generated/runtime-validation/react-query-fetch/model',
        type: 'zod',
      },
      client: 'react-query',
      httpClient: 'fetch',
      override: {
        fetch: {
          runtimeValidation: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/fetch-zod-inline-array.yaml',
    },
  },
  swrFetchValidation: {
    output: {
      target: '../generated/runtime-validation/swr-fetch/endpoints.ts',
      schemas: {
        path: '../generated/runtime-validation/swr-fetch/model',
        type: 'zod',
      },
      client: 'swr',
      httpClient: 'fetch',
      override: {
        fetch: {
          runtimeValidation: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/fetch-zod-inline-array.yaml',
    },
  },
  fetchDatesTransform: {
    output: {
      target: '../generated/runtime-validation/fetch-dates-transform/endpoints.ts',
      schemas: {
        path: '../generated/runtime-validation/fetch-dates-transform/model',
        type: 'zod',
      },
      client: 'fetch',
      override: {
        useDatesTransform: true,
        fetch: { runtimeValidation: true },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: { target: '../specifications/dates-transform.yaml' },
  },
});
