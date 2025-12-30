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
          path: './custom-instance.ts',
          name: 'customInstance',
        },
        formUrlEncoded: {
          path: './custom-form-url-encoded.ts',
          name: 'customFormUrlEncoded',
        },
        // only for the operation id 'createPets'
        // operations: {
        //   createPets: {
        //     formUrlEncoded: {
        //       path: './custom-form-url-encoded.ts',
        //       name: 'customFormUrlEncoded',
        //     },
        //   },
        // },
        // only for the tag 'pets'
        // tags: {
        //   pets: {
        //     formUrlEncoded: {
        //       path: './custom-form-url-encoded.ts',
        //       name: 'customFormUrlEncoded',
        //     },
        //   },
        // },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
