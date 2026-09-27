import { defineConfig } from 'orval';

export default defineConfig({
  logLevel: 'error',
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
  // `useInfiniteQueryParamLocation: 'body'` (#4025): the page param `offset`
  // is a property of the JSON request body, not a URL query parameter.
  // `exportElements` has no `offset` in its body, so it gets no infinite hook.
  infiniteQueryParamBody: {
    output: {
      target:
        '../generated/angular-query/infinite-query-param-body/endpoints.ts',
      schemas: '../generated/angular-query/infinite-query-param-body/model',
      client: 'angular-query',
      mode: 'single',
      clean: true,
      formatter: 'prettier',
      httpClient: 'angular',
      override: {
        query: {
          useInfiniteQueryParam: 'offset',
          useInfiniteQueryParamLocation: 'body',
        },
        operations: {
          searchElements: {
            query: {
              useQuery: true,
              useInfinite: true,
              useSuspenseInfiniteQuery: false,
            },
          },
          searchGroupElements: { query: { useInfinite: true } },
          searchTaggedElements: { query: { useInfinite: true } },
          exportElements: { query: { useInfinite: true } },
        },
      },
    },
    input: {
      target: '../specifications/infinite-query-param-body.yaml',
    },
  },
});
