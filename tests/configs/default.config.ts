import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    input: '../specifications/petstore.yaml',
    output: '../generated/default/petstore/endpoints.ts',
  },
  'petstore-filter': {
    input: {
      target: '../specifications/petstore.yaml',
      filters: {
        tags: ['health'],
        schemas: ['Error', /Cat/],
      },
    },
    output: '../generated/default/petstore-filter/endpoints.ts',
  },
  'petstore-filter-exlude-mode': {
    input: {
      target: '../specifications/petstore.yaml',
      filters: {
        mode: 'exclude',
        tags: ['pets-nested-array'],
        schemas: ['PetsNestedArray'],
      },
    },
    output: '../generated/default/petstore-filter-exclude-mode/endpoints.ts',
  },
  'petstore-transfomer': {
    output: {
      target: '../generated/default/petstore-transformer/endpoints.ts',
      schemas: '../generated/default/petstore-transformer/model',
      mock: true,
    },
    input: {
      target: '../specifications/petstore.yaml',
      override: {
        transformer: '../transformers/add-version.js',
      },
    },
  },
  endpointParameters: {
    input: '../specifications/parameters.yaml',
    output: {
      target: '../generated/default/endpoint-parameters/endpoints.ts',
      schemas: '../generated/default/endpoint-parameters/model',
      mock: true,
    },
  },
  translation: {
    input: '../specifications/translation.yaml',
    output: {
      target: '../generated/default/translation/endpoints.ts',
      schemas: '../generated/default/translation/model',
    },
  },
  regressions: {
    input: '../specifications/regressions.yaml',
    output: {
      target: '../generated/default/regressions/endpoints.ts',
      schemas: '../generated/default/regressions/model',
      mode: 'tags-split',
    },
  },
  'null-type': {
    input: '../specifications/null-type.yaml',
    output: {
      schemas: '../generated/default/null-type/model',
      target: '../generated/default/null-type/endpoints.ts',
    },
  },
  'null-type-v-3-0': {
    input: '../specifications/null-type-v3-0.yaml',
    output: {
      mock: true,
      schemas: '../generated/default/null-type-v3-0/model',
      target: '../generated/default/null-type-v3-0/endpoints.ts',
    },
  },
  readonly: {
    input: '../specifications/readonly.yaml',
    output: {
      schemas: '../generated/default/readonly/model',
      target: '../generated/default/readonly/endpoints.ts',
    },
  },
  'default-status': {
    input: '../specifications/default-status.yaml',
    output: {
      schemas: '../generated/default/default-status/model',
      target: '../generated/default/default-status/endpoints.ts',
    },
  },
  'all-of-one-of': {
    input: '../specifications/all-of-one-of.yaml',
    output: {
      schemas: '../generated/default/all-of-one-of/model',
      target: '../generated/default/all-of-one-of/endpoints.ts',
      mock: true,
    },
  },
  'all-of-without-type': {
    input: '../specifications/all-of-without-type.yaml',
    output: {
      schemas: '../generated/default/all-of-without-type/model',
      target: '../generated/default/all-of-without-type/endpoints.ts',
      mock: true,
    },
  },
  'all-of-required-in-parent': {
    input: '../specifications/all-of-required-in-parent.yaml',
    output: {
      schemas: '../generated/default/all-of-required-in-parent/model',
      target: '../generated/default/all-of-required-in-parent/endpoints.ts',
      mock: true,
    },
  },
  'all-of-all-of': {
    input: '../specifications/all-of-all-of.yaml',
    output: {
      schemas: '../generated/default/all-of-all-of/model',
      target: '../generated/default/all-of-all-of/endpoints.ts',
      mock: true,
    },
  },
  'all-of-primitive': {
    input: '../specifications/all-of-primitive.yaml',
    output: {
      schemas: '../generated/default/all-of-primitive/model',
      target: '../generated/default/all-of-primitive/endpoints.ts',
      mock: true,
    },
  },
  'one-of': {
    input: '../specifications/one-of.yaml',
    output: {
      schemas: '../generated/default/one-of/model',
      target: '../generated/default/one-of/endpoints.ts',
      mock: true,
    },
  },
  'one-of-primitive': {
    input: '../specifications/one-of-primitive.yaml',
    output: {
      schemas: '../generated/default/one-of-primitive/model',
      target: '../generated/default/one-of-primitive/endpoints.ts',
      mock: true,
    },
  },
  'one-of-required': {
    input: '../specifications/one-of-required.yaml',
    output: {
      schemas: '../generated/default/one-of-required/model',
      target: '../generated/default/one-of-required/endpoints.ts',
      mock: true,
    },
  },
  'one-of-nested': {
    input: '../specifications/one-of-nested.yaml',
    output: {
      schemas: '../generated/default/one-of-nested/model',
      target: '../generated/default/one-of-nested/endpoints.ts',
      mock: true,
    },
  },
  'any-of-primitive': {
    input: '../specifications/any-of-primitive.yaml',
    output: {
      schemas: '../generated/default/any-of-primitive/model',
      target: '../generated/default/any-of-primitive/endpoints.ts',
      mock: true,
    },
  },
  'circular-v2': {
    input: '../specifications/circular-v2.yaml',
    output: {
      schemas: '../generated/default/circular-v2/model',
      target: '../generated/default/circular-v2/endpoints.ts',
      mock: true,
    },
  },
  'any-of': {
    input: '../specifications/any-of.yaml',
    output: {
      schemas: '../generated/default/any-of/model',
      target: '../generated/default/any-of/endpoints.ts',
      mock: true,
    },
  },
  'all-of': {
    input: '../specifications/all-of.yaml',
    output: {
      schemas: '../generated/default/all-of/model',
      target: '../generated/default/all-of/endpoints.ts',
      mock: true,
    },
  },
  'all-of-ref': {
    input: '../specifications/all-of-ref.yaml',
    output: {
      schemas: '../generated/default/all-of-ref/model',
      target: '../generated/default/all-of-ref/endpoints.ts',
      mock: true,
    },
  },
  'all-of-strict': {
    input: '../specifications/all-of-strict.yaml',
    output: {
      schemas: '../generated/default/all-of-strict/model',
      target: '../generated/default/all-of-strict/endpoints.ts',
      mock: true,
      client: 'zod',
      override: {
        zod: {
          strict: {
            body: true,
            param: false,
            query: false,
            header: false,
            response: false,
          },
        },
      },
    },
  },
  'deeply-nested-refs': {
    input: '../specifications/deeply-nested-refs.yaml',
    output: {
      schemas: '../generated/default/deeply-nested-refs/model',
      target: '../generated/default/deeply-nested-refs/endpoints.ts',
    },
  },
  'example-v3-1': {
    input: '../specifications/example-v3-1.yaml',
    output: {
      mock: true,
      schemas: '../generated/default/example-v3-1/model',
      target: '../generated/default/example-v3-1/endpoints.ts',
    },
  },
  'override-mock': {
    input: '../specifications/petstore.yaml',
    output: {
      mode: 'split',
      mock: true,
      schemas: '../generated/default/override-mock/model',
      target: '../generated/default/override-mock/endpoints.ts',
      override: {
        operations: {
          listPets: {
            mock: {
              data: () => {
                return {};
              },
            },
          },
        },
      },
    },
  },
  'runtime-mock-delay': {
    input: '../specifications/petstore.yaml',
    output: {
      mock: {
        delay: () => 400,
        delayFunctionLazyExecute: true,
        type: 'msw',
      },
      schemas: '../generated/default/runtime-mock-delay/model',
      target: '../generated/default/runtime-mock-delay/endpoints.ts',
    },
  },
  'http-status-mocks': {
    input: '../specifications/petstore.yaml',
    output: {
      mock: {
        generateEachHttpStatus: true,
        type: 'msw',
      },
      schemas: '../generated/default/http-status-mocks/model',
      target: '../generated/default/http-status-mocks/endpoints.ts',
    },
  },
  'combined-enum': {
    input: '../specifications/combined-enum.yaml',
    output: {
      schemas: '../generated/default/combine-enum/schemas',
      target: '../generated/default/combine-enum',
      mock: true,
    },
  },
  const: {
    input: '../specifications/const.yaml',
    output: {
      schemas: '../generated/default/const/model',
      target: '../generated/default/const',
      mock: true,
    },
  },
  noIndexFiles: {
    output: {
      target: '../generated/default/no-index-files/endpoints.ts',
      schemas: '../generated/default/no-index-files/model',
      client: 'fetch',
      indexFiles: false,
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  multipleTags: {
    output: {
      target: '../generated/default/multiple-tags/endpoints.ts',
      schemas: '../generated/default/multiple-tags/model',
      mode: 'tags',
    },
    input: {
      target: '../specifications/multiple-tags.yaml',
    },
  },
  indexMockFiles: {
    output: {
      target: '../generated/default/index-mock-file/endpoints.ts',
      schemas: '../generated/default/index-mock-file/model',
      client: 'fetch',
      mock: {
        type: 'msw',
        indexMockFiles: true,
      },
      mode: 'tags-split',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreNamingConventionCamelCase: {
    input: '../specifications/petstore.yaml',
    output: {
      mode: 'split',
      target:
        '../generated/default/petstore-naming-convention-camel-case/endpoints',
      schemas:
        '../generated/default/petstore-naming-convention-camel-case/model',
      namingConvention: 'camelCase',
    },
  },
  petstoreNamingConventionPascalCase: {
    input: '../specifications/petstore.yaml',
    output: {
      mode: 'split',
      target:
        '../generated/default/petstore-naming-convention-pascal-case/endpoints',
      schemas:
        '../generated/default/petstore-naming-convention-pascal-case/model',
      namingConvention: 'PascalCase',
    },
  },
  petstoreNamingConventionKebabCase: {
    input: '../specifications/petstore.yaml',
    output: {
      mode: 'split',
      target:
        '../generated/default/petstore-naming-convention-kebab-case/endpoints',
      schemas:
        '../generated/default/petstore-naming-convention-kebab-case/model',
      namingConvention: 'kebab-case',
    },
  },
  petstoreNamingConventionSnakeCase: {
    input: '../specifications/petstore.yaml',
    output: {
      mode: 'split',
      target:
        '../generated/default/petstore-naming-convention-snake-case/endpoints',
      schemas:
        '../generated/default/petstore-naming-convention-snake-case/model',
      namingConvention: 'snake_case',
    },
  },
  lowerCaseDiscriminator: {
    input: '../specifications/lowercase-discriminator.yaml',
    output: '../generated/default/lowercase-discriminator/endpoints.ts',
  },
  constEnums: {
    output: {
      target: '../generated/default/enums/const/endpoints.ts',
      schemas: '../generated/default/enums/const/model',
      mock: true,
    },
    input: {
      target: '../specifications/enums.yaml',
    },
  },
  nativeEnums: {
    output: {
      target: '../generated/default/enums/native/endpoints.ts',
      schemas: '../generated/default/enums/native/model',
      mock: true,
      override: {
        enumGenerationType: 'enum',
      },
    },
    input: {
      target: '../specifications/enums.yaml',
    },
  },
  unionEnums: {
    output: {
      target: '../generated/default/enums/union/endpoints.ts',
      schemas: '../generated/default/enums/union/model',
      mock: true,
      override: {
        enumGenerationType: 'union',
      },
    },
    input: {
      target: '../specifications/enums.yaml',
    },
  },
  formDataExplode: {
    output: {
      target: '../generated/default/form-data-explode/endpoints.ts',
      schemas: '../generated/default/form-data-explode/model',
      override: {
        formData: {
          arrayHandling: 'explode',
        },
      },
    },
    input: {
      target: '../specifications/form-data-nested.yaml',
    },
  },
  overrideJsDOc: {
    output: {
      target: '../generated/default/override-js-doc/endpoints.ts',
      override: {
        jsDoc: {
          filter: (schema) => {
            const allowlist = new Set([
              'type',
              'format',
              'maxLength',
              'minLength',
              'description',
              'minimum',
              'maximum',
              'exclusiveMinimum',
              'exclusiveMaximum',
              'pattern',
              'nullable',
              'enum',
            ]);
            return Object.entries(schema || {})
              .filter(([key]) => allowlist.has(key))
              .map(([key, value]) => {
                return {
                  key,
                  value,
                };
              })
              .sort((a, b) => {
                return a.key.length - b.key.length;
              });
          },
        },
      },
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  'multi-files-with-same-import-names': {
    output: {
      target:
        '../generated/default/multi-files-with-same-import-names/endpoints.ts',
      schemas: '../generated/default/multi-files-with-same-import-names/model',
    },
    input: '../specifications/multi-files-with-same-import-names/api.yaml',
  },
  'external-ref': {
    input: {
      target: '../specifications/external-ref.yaml',
    },
    output: '../generated/default/external-ref/endpoints.ts',
  },
  'nullable-any-of-refs': {
    input: {
      target: '../specifications/nullable-any-of-refs.yaml',
    },
    output: {
      target: '../generated/default/nullable-any-of-refs/endpoints.ts',
      schemas: '../generated/default/nullable-any-of-refs/model',
      mock: true,
    },
  },
  'nullable-oneof-enums': {
    input: {
      target: '../specifications/nullable-oneof-enums.yaml',
    },
    output: {
      target: '../generated/default/nullable-oneof-enums/endpoints.ts',
      schemas: '../generated/default/nullable-oneof-enums/model',
      mock: true,
    },
  },
  'schemas-typescript-only': {
    output: {
      target: '../generated/default/schemas-typescript-only/endpoints.ts',
      schemas: {
        path: '../generated/default/schemas-typescript-only/model',
        type: 'typescript',
      },
      client: 'fetch',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  'schemas-zod-only': {
    output: {
      target: '../generated/default/schemas-zod-only/endpoints.ts',
      schemas: {
        path: '../generated/default/schemas-zod-only/model',
        type: 'zod',
      },
      client: 'zod',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  'branded-types': {
    input: {
      target: '../specifications/branded-types.yaml',
    },
    output: {
      target: '../generated/default/branded-types/endpoints.ts',
      schemas: '../generated/default/branded-types/model',
      override: {
        useBrandedTypes: true,
      },
    },
  },
  'branded-types-with-type-generation': {
    input: {
      target: '../specifications/branded-types.yaml',
    },
    output: {
      target: '../generated/default/branded-types-with-bigint/endpoints.ts',
      schemas: '../generated/default/branded-types-with-bigint/model',
      override: {
        useBrandedTypes: true,
        useBigInt: true,
        useDates: true,
      },
    },
  },
  'branded-types-tags-split': {
    input: {
      target: '../specifications/branded-types.yaml',
    },
    output: {
      target: '../generated/default/branded-types-tags-split/endpoints.ts',
      schemas: '../generated/default/branded-types-tags-split/model',
      mode: 'tags-split',
      override: {
        useBrandedTypes: true,
      },
    },
  },
});
