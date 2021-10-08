import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/angular/petstore/endpoints.ts',
      schemas: '../generated/angular/petstore/model',
      client: 'angular',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
});
