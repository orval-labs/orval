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
      prettier: true,
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
      prettier: true,
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
      prettier: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
});
