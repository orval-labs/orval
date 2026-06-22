import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/angular/petstore/endpoints.ts',
      schemas: '../generated/angular/petstore/model',
      client: 'angular',
      mock: true,
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
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
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  httpResourceZod: {
    output: {
      target: '../generated/angular/http-resource-zod/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/angular/http-resource-zod/model',
      },
      mock: true,
      client: 'angular',
      override: {
        angular: {
          retrievalClient: 'httpResource',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpResourceTags: {
    output: {
      target: '../generated/angular/http-resource-tags/endpoints.ts',
      schemas: '../generated/angular/http-resource-tags/model',
      client: 'angular',
      mode: 'tags',
      mock: false,
      clean: true,
      formatter: 'prettier',
      override: {
        angular: {
          retrievalClient: 'httpResource',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpResourceZodDisabled: {
    output: {
      target: '../generated/angular/http-resource-zod-disabled/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/angular/http-resource-zod-disabled/model',
      },
      mock: true,
      client: 'angular',
      override: {
        angular: {
          retrievalClient: 'httpResource',
          runtimeValidation: false,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpResourceBothTagsSplit: {
    output: {
      target: '../generated/angular/http-resource-both-tags-split/endpoints.ts',
      schemas: '../generated/angular/http-resource-both-tags-split/model',
      client: 'angular',
      mode: 'tags-split',
      mock: false,
      clean: true,
      formatter: 'prettier',
      override: {
        angular: {
          retrievalClient: 'both',
        },
      },
    },
    input: {
      target: '../specifications/angular-http-resource-both.yaml',
    },
  },
  issue3624: {
    output: {
      target: '../generated/angular/issue-3624/petstore.client.ts',
      schemas: {
        path: '../generated/angular/issue-3624/petstore.schemas',
      },
      mode: 'split',
      client: 'angular',
      mock: false,
      clean: true,
      indexFiles: true,
      formatter: 'prettier',
      override: {
        angular: {
          retrievalClient: 'httpResource',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  multiContentQueryParams: {
    output: {
      target: '../generated/angular/multi-content-query-params/endpoints.ts',
      schemas: '../generated/angular/multi-content-query-params/model',
      client: 'angular',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/angular-multi-content-query-params.yaml',
    },
  },
  issue3103: {
    output: {
      target: '../generated/angular/issue-3103/endpoints.ts',
      schemas: '../generated/angular/issue-3103/model',
      client: 'angular',
      mode: 'tags-split',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3103.yaml',
    },
  },
  issue3326: {
    output: {
      target: '../generated/angular/issue-3326/endpoints.ts',
      schemas: '../generated/angular/issue-3326/model',
      client: 'angular',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3326.yaml',
    },
  },
  issue3326Filter: {
    output: {
      target: '../generated/angular/issue-3326-filter/endpoints.ts',
      schemas: '../generated/angular/issue-3326-filter/model',
      client: 'angular',
      clean: true,
      formatter: 'prettier',
      override: {
        paramsFilter: {
          path: '../mutators/params-filter.ts',
          name: 'flattenParamsFilter',
        },
      },
    },
    input: {
      target: '../specifications/issue-3326.yaml',
    },
  },
  issue3326Serializer: {
    output: {
      target: '../generated/angular/issue-3326-serializer/endpoints.ts',
      schemas: '../generated/angular/issue-3326-serializer/model',
      client: 'angular',
      clean: true,
      formatter: 'prettier',
      override: {
        paramsSerializer: {
          path: '../mutators/params-serializer.ts',
          name: 'customParamsSerializer',
        },
      },
    },
    input: {
      target: '../specifications/issue-3326.yaml',
    },
  },
  urlEncodeParameters: {
    output: {
      target: '../generated/angular/url-encode-parameters/endpoints.ts',
      schemas: '../generated/angular/url-encode-parameters/model',
      client: 'angular',
      mock: true,
      urlEncodeParameters: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  urlEncodeParametersHttpResource: {
    output: {
      target:
        '../generated/angular/url-encode-parameters-http-resource/endpoints.ts',
      schemas: '../generated/angular/url-encode-parameters-http-resource/model',
      client: 'angular',
      mock: false,
      urlEncodeParameters: true,
      clean: true,
      formatter: 'prettier',
      override: {
        angular: {
          retrievalClient: 'httpResource',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
});
