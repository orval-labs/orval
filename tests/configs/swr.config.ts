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
});
