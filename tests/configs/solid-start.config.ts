import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/solid-start/petstore/endpoints.ts',
      schemas: '../generated/solid-start/petstore/model',
      client: 'solid-start',
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
      target: '../generated/solid-start/petstore-tags-split/endpoints.ts',
      schemas: '../generated/solid-start/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'solid-start',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/solid-start/split/endpoints.ts',
      schemas: '../generated/solid-start/split/model',
      mock: true,
      mode: 'split',
      client: 'solid-start',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/solid-start/tags/endpoints.ts',
      schemas: '../generated/solid-start/tags/model',
      mock: true,
      mode: 'tags',
      client: 'solid-start',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mutator: {
    output: {
      target: '../generated/solid-start/mutator/endpoints.ts',
      schemas: '../generated/solid-start/mutator/model',
      client: 'solid-start',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
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
  namedParameters: {
    output: {
      target: '../generated/solid-start/named-parameters/endpoints.ts',
      schemas: '../generated/solid-start/named-parameters/model',
      client: 'solid-start',
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
});
