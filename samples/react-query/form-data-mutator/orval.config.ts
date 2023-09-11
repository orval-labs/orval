import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: './endpoints.ts',
      schemas: './models',
      client: 'react-query',
      prettier: true,
      override: {
        mutator: {
          path: './custom-instance.ts',
          name: 'customInstance',
        },
        formData: {
          path: './custom-form-data.ts',
          name: 'customFormData',
        },
        // only for the operation id 'createPets'
        // operations: {
        //   createPets: {
        //     formData: {
        //       path: './custom-form-data.ts',
        //       name: 'customFormData',
        //     },
        //   },
        // },
        // only for the tag 'pets'
        // tags: {
        //   pets: {
        //     formData: {
        //       path: './custom-form-data.ts',
        //       name: 'customFormData',
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
