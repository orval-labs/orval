import { defineConfig } from 'orval';

export default defineConfig({
  basic: {
    output: {
      target: '../generated/react-query/basic/endpoints.ts',
      schemas: '../generated/react-query/basic/model',
      client: 'react-query',
      mock: true,
      headers: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  invalidates: {
    output: {
      target: '../generated/react-query/invalidates/endpoints.ts',
      schemas: '../generated/react-query/invalidates/model',
      client: 'react-query',
      mock: true,
      headers: true,
      override: {
        query: {
          mutationInvalidates: [
            {
              onMutations: ['createPets'],
              invalidates: ['listPets'],
            },
            {
              onMutations: ['deletePet', 'updatePet', 'patchPet'],
              invalidates: [
                'listPets',
                { query: 'showPetById', params: ['petId'] },
              ],
            },
            {
              onMutations: ['uploadFile'],
              invalidates: ['listPets'],
            },
          ],
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  zodSchemaResponse: {
    output: {
      target: '../generated/react-query/zod-schema-response/endpoints.ts',
      schemas: {
        type: 'zod',
        path: '../generated/react-query/zod-schema-response/model',
      },
      mock: true,
      client: 'react-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  noContentWithDefault: {
    output: {
      target: '../generated/react-query/no-content-with-default/endpoints.ts',
      schemas: '../generated/react-query/no-content-with-default/model',
      mode: 'split',
      client: 'react-query',
      mock: {
        type: 'msw',
        delay: 0,
        useExamples: true,
      },
      headers: true,
    },
    input: {
      target: '../specifications/no-content-with-default.yaml',
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/react-query/petstore-tags-split/endpoints.ts',
      schemas: '../generated/react-query/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'react-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/react-query/split/endpoints.ts',
      schemas: '../generated/react-query/split/model',
      mock: true,
      mode: 'split',
      client: 'react-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/react-query/tags/endpoints.ts',
      schemas: '../generated/react-query/tags/model',
      mock: true,
      mode: 'tags',
      client: 'react-query',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplitQueryKey: {
    output: {
      target: '../generated/react-query/split-query-key/endpoints.ts',
      schemas: '../generated/react-query/split-query-key/model',
      client: 'react-query',
      override: {
        query: {
          shouldSplitQueryKey: true,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreCustomMutatorOptions: {
    output: {
      target: '../generated/react-query/custom-mutator-options/endpoints.ts',
      schemas: '../generated/react-query/custom-mutator-options/model',
      client: 'react-query',
      override: {
        query: {
          mutationOptions: {
            path: '../mutators/custom-mutation.ts',
            name: 'useCustomMutation',
          },
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetch: {
    output: {
      target: '../generated/react-query/http-client-fetch/endpoints.ts',
      schemas: '../generated/react-query/http-client-fetch/model',
      mode: 'tags-split',
      client: 'react-query',
      override: {
        fetch: {
          forceSuccessResponse: true,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  httpClientFetchWithIncludeHttpResponseReturnType: {
    output: {
      target:
        '../generated/react-query/http-client-fetch-with-include-http-response-return-type/endpoints.ts',
      schemas:
        '../generated/react-query/http-client-fetch-with-include-http-response-return-type/model',
      mode: 'tags-split',
      client: 'react-query',
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mutator: {
    output: {
      target: '../generated/react-query/mutator/endpoints.ts',
      schemas: '../generated/react-query/mutator/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
        query: {
          useSuspenseQuery: true,
          useSuspenseInfiniteQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
      target: '../generated/react-query/mutator-client/endpoints.ts',
      schemas: '../generated/react-query/mutator-client/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      headers: true,
      override: {
        mutator: {
          path: '../mutators/custom-client.ts',
          name: 'customClient',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
  httpClientFetchWithCustomFetch: {
    output: {
      target:
        '../generated/react-query/http-client-fetch-with-custom-fetch/endpoints.ts',
      schemas:
        '../generated/react-query/http-client-fetch-with-custom-fetch/model',
      client: 'react-query',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mutatorMultiArguments: {
    output: {
      target: '../generated/react-query/mutator-multi-arguments/endpoints.ts',
      schemas: '../generated/react-query/mutator-multi-arguments/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/multi-arguments.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
  errorType: {
    output: {
      target: '../generated/react-query/error-type/endpoints.ts',
      schemas: '../generated/react-query/error-type/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/error-type.ts',
          name: 'customInstance',
        },
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
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
  hookMutator: {
    output: {
      target: '../generated/react-query/hook-mutator/endpoints.ts',
      schemas: '../generated/react-query/hook-mutator/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance.ts',
          name: 'useCustomInstance',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  hookMutatorWithExtension: {
    output: {
      target: '../generated/react-query/hook-mutator/endpoints.ts',
      schemas: '../generated/react-query/hook-mutator/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance.ts',
          name: 'useCustomInstance',
          extension: '.js',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  hookMutatorWithSecondParameter: {
    output: {
      target:
        '../generated/react-query/hook-mutator-with-second-parameter/endpoints.ts',
      schemas:
        '../generated/react-query/hook-mutator-with-second-parameter/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance-with-second-parameter.ts',
          name: 'useCustomInstance',
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  tagHookMutator: {
    output: {
      target: '../generated/react-query/tag-hook-mutator/endpoints.ts',
      schemas: '../generated/react-query/tag-hook-mutator/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        tags: {
          pets: {
            mutator: {
              path: '../mutators/use-custom-instance.ts',
              name: 'useCustomInstance',
            },
          },
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  formData: {
    output: {
      target: '../generated/react-query/form-data/endpoints.ts',
      schemas: '../generated/react-query/form-data/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
    input: {
      target: '../specifications/form-data.yaml',
    },
  },
  formDataWithHook: {
    output: {
      target: '../generated/react-query/form-data-with-hook/endpoints.ts',
      schemas: '../generated/react-query/form-data-with-hook/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/use-custom-instance.ts',
          name: 'useCustomInstance',
        },
      },
    },
    input: {
      target: '../specifications/form-data.yaml',
    },
  },
  formDataMutator: {
    output: {
      target: '../generated/react-query/form-data-with-mutator/endpoints.ts',
      schemas: '../generated/react-query/form-data-with-mutator/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
        formData: {
          path: '../mutators/custom-form-data.ts',
          name: 'customFormData',
        },
      },
    },
    input: {
      target: '../specifications/form-data.yaml',
    },
  },
  formUrlEncoded: {
    output: {
      target: '../generated/react-query/form-url-encoded/endpoints.ts',
      schemas: '../generated/react-query/form-url-encoded/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
      },
    },
    input: {
      target: '../specifications/form-url-encoded.yaml',
    },
  },
  formUrlEncodedMutator: {
    output: {
      target: '../generated/react-query/formUrlEncoded/endpoints.ts',
      schemas: '../generated/react-query/formUrlEncoded/model',
      client: 'react-query',
      httpClient: 'axios',
      mock: true,
      override: {
        mutator: {
          path: '../mutators/custom-instance.ts',
          name: 'customInstance',
        },
        formUrlEncoded: {
          path: '../mutators/custom-form-url-encoded.ts',
          name: 'customFormUrlEncoded',
        },
      },
    },
    input: {
      target: '../specifications/form-url-encoded.yaml',
    },
  },
  importFromSubdirectory: {
    output: {
      target: '../generated/react-query/importFromSubdirectory/endpoints.ts',
      schemas: '../generated/react-query/importFromSubdirectory/model',
      client: 'react-query',
      mode: 'split',
      mock: true,
    },
    input: '../specifications/import-from-subdirectory/petstore.yaml',
  },
  deprecated: {
    output: {
      target: '../generated/react-query/deprecated/endpoints.ts',
      schemas: '../generated/react-query/deprecated/model',
      client: 'react-query',
      mock: true,
      override: {
        useDeprecatedOperations: false,
      },
    },
    input: '../specifications/deprecated.yaml',
  },
  mockOverride: {
    output: {
      target: '../generated/react-query/mockOverride/endpoints.ts',
      schemas: '../generated/react-query/mockOverride/model',
      client: 'react-query',
      mock: true,
      override: {
        mock: {
          arrayMin: 5,
          arrayMax: 15,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  mockWithoutDelay: {
    output: {
      target: '../generated/react-query/mockWithoutDelay/endpoints.ts',
      schemas: '../generated/react-query/mockWithoutDelay/model',
      client: 'react-query',
      mock: {
        type: 'msw',
        delay: false,
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  polymorphic: {
    output: {
      target: '../generated/react-query/polymorphic/endpoints.ts',
      schemas: '../generated/react-query/polymorphic/model',
      client: 'react-query',
      mock: true,
      headers: true,
    },
    input: {
      target: '../specifications/polymorphic.yaml',
    },
  },
  namedParameters: {
    output: {
      target: '../generated/react-query/named-parameters/endpoints.ts',
      schemas: '../generated/react-query/named-parameters/model',
      client: 'react-query',
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
  specialCharacters: {
    output: {
      target: '../generated/react-query/special-characters/endpoints.ts',
      schemas: '../generated/react-query/special-characters/model',
      client: 'react-query',
      mock: true,
    },
    input: {
      target: '../specifications/models-with-special-char.yaml',
    },
  },
  usePrefetchWithFunctionMutator: {
    output: {
      target:
        '../generated/react-query/use-prefetch-with-function/endpoints.ts',
      schemas: '../generated/react-query/use-prefetch-with-function/model',
      client: 'react-query',
      override: {
        query: {
          usePrefetch: true,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  usePrefetchWithHookMutator: {
    output: {
      target:
        '../generated/react-query/use-prefetch-with-hook-mutator/endpoints.ts',
      schemas: '../generated/react-query/use-prefetch-with-hook-mutator/model',
      client: 'react-query',
      httpClient: 'axios',
      override: {
        mutator: {
          path: '../mutators/use-custom-instance.ts',
          name: 'useCustomInstance',
        },
        query: {
          usePrefetch: true,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  useInvalidate: {
    output: {
      target: '../generated/react-query/use-invalidate/endpoints.ts',
      schemas: '../generated/react-query/use-invalidate/model',
      client: 'react-query',
      override: {
        query: {
          useInvalidate: true,
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
});
