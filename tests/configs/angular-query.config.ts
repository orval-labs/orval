import { defineConfig } from 'orval';

export default defineConfig({
  basic: {
    output: {
      target: '../generated/angular-query/basic/endpoints.ts',
      schemas: '../generated/angular-query/basic/model',
      client: 'angular-query',
      httpClient: 'angular',
      override: {
        query: {
          signal: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  tagsSplit: {
    output: {
      target: '../generated/angular-query/tags-split/endpoints.ts',
      schemas: '../generated/angular-query/tags-split/model',
      client: 'angular-query',
      httpClient: 'angular',
      mode: 'tags-split',
      override: {
        query: {
          signal: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  split: {
    output: {
      target: '../generated/angular-query/split/endpoints.ts',
      schemas: '../generated/angular-query/split/model',
      client: 'angular-query',
      httpClient: 'angular',
      mode: 'split',
      override: {
        query: {
          signal: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  usePrefetch: {
    output: {
      target: '../generated/angular-query/use-prefetch/endpoints.ts',
      schemas: '../generated/angular-query/use-prefetch/model',
      client: 'angular-query',
      httpClient: 'angular',
      override: {
        query: {
          usePrefetch: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  urlEncodeParameters: {
    output: {
      target: '../generated/angular-query/url-encode-parameters/endpoints.ts',
      schemas: '../generated/angular-query/url-encode-parameters/model',
      client: 'angular-query',
      httpClient: 'angular',
      mock: true,
      urlEncodeParameters: true,
      override: {
        query: {
          signal: true,
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
