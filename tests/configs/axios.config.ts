import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/axios/petstore/endpoints.ts',
      schemas: '../generated/axios/petstore/model',
      mock: true,
      client: 'axios',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  mutator: {
    output: {
      target: '../generated/axios/mutator/endpoints.ts',
      schemas: '../generated/axios/mutator/model',
      mock: true,
      client: 'axios',
      override: {
        mutator: '../mutators/custom-client.ts',
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  multiArguments: {
    output: {
      target: '../generated/axios/multi-arguments/endpoints.ts',
      schemas: '../generated/axios/multi-arguments/model',
      mock: true,
      client: 'axios',
      override: {
        mutator: '../mutators/multi-arguments.ts',
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
      target: '../generated/axios/petstore-tags-split/endpoints.ts',
      schemas: '../generated/axios/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'axios',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/axios/split/endpoints.ts',
      schemas: '../generated/axios/split/model',
      mock: true,
      mode: 'split',
      client: 'axios',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/axios/tags/endpoints.ts',
      schemas: '../generated/axios/tags/model',
      mock: true,
      mode: 'tags',
      client: 'axios',
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
      target: '../generated/axios/named-parameters/endpoints.ts',
      schemas: '../generated/axios/named-parameters/model',
      client: 'axios-functions',
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
