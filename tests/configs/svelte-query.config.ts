import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/svelte-query/petstore/endpoints.ts',
      schemas: '../generated/svelte-query/petstore/model',
      client: 'svelte-query',
      mock: true,
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
  petstoreTagsSplit: {
    output: {
      target: '../generated/svelte-query/petstore-tags-split/endpoints.ts',
      schemas: '../generated/svelte-query/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'svelte-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/svelte-query/split/endpoints.ts',
      schemas: '../generated/svelte-query/split/model',
      mock: true,
      mode: 'split',
      client: 'svelte-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/svelte-query/tags/endpoints.ts',
      schemas: '../generated/svelte-query/tags/model',
      mock: true,
      mode: 'tags',
      client: 'svelte-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mutator: {
    output: {
      target: '../generated/svelte-query/mutator/endpoints.ts',
      schemas: '../generated/svelte-query/mutator/model',
      client: 'svelte-query',
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
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  namedParameters: {
    output: {
      target: '../generated/svelte-query/named-parameters/endpoints.ts',
      schemas: '../generated/svelte-query/named-parameters/model',
      client: 'svelte-query',
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
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
});
