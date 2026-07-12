import { defineConfig } from 'orval';

// Fixtures exercising the `runtimeValidation: { strategy: 'both' }` strategy
// (safeParse -> console.error -> throw) across every client that supports
// runtime validation. The `throw`/boolean path is covered by the existing
// per-client configs; these isolate the additive `both` output so its diff is
// reviewed independently.
export default defineConfig({
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
});
