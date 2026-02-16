import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: './endpoints.ts',
      schemas: './models',
      client: 'react-query',
      httpClient: 'axios',
      prettier: true,
      override: {
        mutator: {
          path: './use-custom-instance.ts',
          name: 'useCustomInstance',
        },

        // only for the operation id 'createPets'
        // operations: {
        //   createPets: {
        //     mutator: {
        //       path: './use-custom-instance.ts',
        //       name: 'useCustomInstance',
        //     },
        //   },
        // },
        // only for the tag 'pets'
        // tags: {
        //   pets: {
        //     mutator: {
        //       path: './use-custom-instance.ts',
        //       name: 'useCustomInstance',
        //     },
        //   },
        // },
        // for ES Module imports
        // {
        //  mutator: {
        //    path: './use-custom-instance.ts',
        //    name: 'useCustomInstance',
        //    extension: '.js',
        //  }
        // }
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
