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
  mutator: {
    output: {
      target: '../generated/swr/mutator/endpoints.ts',
      schemas: '../generated/swr/mutator/model',
      client: 'swr',
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
  customClient: {
    output: {
      target: '../generated/swr/mutator/endpoints.ts',
      schemas: '../generated/swr/mutator/model',
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
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
});
