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
  zodSchemaResponse: {
    output: {
      target: '../generated/angular/zod-schema-response/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/angular/zod-schema-response/model',
      },
      mock: true,
      client: 'angular',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  tagsSplit: {
    output: {
      target: '../generated/angular/tags-split/endpoints.ts',
      schemas: '../generated/angular/tags-split/model',
      client: 'angular',
      mode: 'tags-split',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  split: {
    output: {
      target: '../generated/angular/split/endpoints.ts',
      schemas: '../generated/angular/split/model',
      client: 'angular',
      mode: 'split',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  tags: {
    output: {
      target: '../generated/angular/tags/endpoints.ts',
      schemas: '../generated/angular/tags/model',
      client: 'angular',
      mode: 'tags',
      mock: true,
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
      target: '../generated/angular/custom-client/endpoints.ts',
      schemas: '../generated/angular/custom-client/model',
      client: 'angular',
      mock: true,
      override: {
        mutator: '../mutators/custom-client-angular.ts',
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
      target: '../generated/angular/named-parameters/endpoints.ts',
      schemas: '../generated/angular/named-parameters/model',
      client: 'angular',
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
