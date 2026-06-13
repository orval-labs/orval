import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      target: '../generated/mock/petstore/endpoints.ts',
      schemas: '../generated/mock/petstore/model',
      client: 'axios',
      mock: true,
      override: {
        mock: {
          properties: {
            name: 'jon',
          },
          format: {
            email: () => faker.internet.email(),
          },
          required: true,
          delay: 500,
          arrayMin: 3,
          arrayMax: 5,
          stringMin: 10,
          stringMax: 30,
          numberMin: 0,
          numberMax: 100,
          useExamples: true,
          baseUrl: 'https://petstore.swagger.io/v1',
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  endpointsNamedDelay: {
    output: {
      schemas: '../generated/mock/endpoints-named-delay/model',
      target: '../generated/mock/endpoints-named-delay/endpoints.ts',
      mock: {
        generators: [{ type: 'msw', delay: false }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/endpoints-named-delay.yaml',
    },
  },
  petstoreEachHttpStatus: {
    output: {
      target: '../generated/mock/petstore-each-http-status/endpoints.ts',
      schemas: '../generated/mock/petstore-each-http-status/model',
      client: 'axios',
      mock: true,
      override: {
        mock: {
          generateEachHttpStatus: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/default-status.yaml',
    },
  },
  petstoreCustomMockBuilder: {
    output: {
      target: '../generated/mock/petstore-custom-mock-builder/endpoints.ts',
      schemas: '../generated/mock/petstore-custom-mock-builder/model',
      client: 'axios',
      mock: (verbOptions, _) => {
        const handlerName = `${verbOptions.operationId}MockHandler`;

        return {
          imports: [],
          implementation: {
            function: '',
            handlerName: handlerName,
            handler: `const ${handlerName} = () => { return { data: { id: 1, name: "myName" } } }\n`,
          },
        };
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Regression for https://github.com/orval-labs/orval/issues/3554:
  // a function-form mock generator (ClientMockBuilder) used to be
  // silently dropped in `split` mode. It must now be treated as MSW.
  petstoreCustomMockBuilderSplit: {
    output: {
      target:
        '../generated/mock/petstore-custom-mock-builder-split/endpoints.ts',
      schemas: '../generated/mock/petstore-custom-mock-builder-split/model',
      mode: 'split',
      client: 'axios',
      mock: (verbOptions, _) => {
        const handlerName = `${verbOptions.operationId}MockHandler`;

        return {
          imports: [],
          implementation: {
            function: '',
            handlerName: handlerName,
            handler: `const ${handlerName} = () => { return { data: { id: 1, name: "myName" } } }\n`,
          },
        };
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  // Regression for https://github.com/orval-labs/orval/issues/3554:
  // a function-form mock generator (ClientMockBuilder) used to throw
  // in `tags-split` mode. The throw was removed but never replaced with
  // generation — this config verifies the throw is gone and the file is
  // written.
  petstoreCustomMockBuilderTagsSplit: {
    output: {
      target:
        '../generated/mock/petstore-custom-mock-builder-tags-split/endpoints.ts',
      schemas:
        '../generated/mock/petstore-custom-mock-builder-tags-split/model',
      mode: 'tags-split',
      client: 'axios',
      mock: (verbOptions, _) => {
        const handlerName = `${verbOptions.operationId}MockHandler`;

        return {
          imports: [],
          implementation: {
            function: '',
            handlerName: handlerName,
            handler: `const ${handlerName} = () => { return { data: { id: 1, name: "myName" } } }\n`,
          },
        };
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTagsSplit: {
    output: {
      target: '../generated/mock/petstore-tags-split/endpoints.ts',
      schemas: '../generated/mock/petstore-tags-split/model',
      mock: true,
      mode: 'tags-split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreSplit: {
    output: {
      target: '../generated/mock/split/endpoints.ts',
      schemas: '../generated/mock/split/model',
      mock: true,
      mode: 'split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreTags: {
    output: {
      target: '../generated/mock/tags/endpoints.ts',
      schemas: '../generated/mock/tags/model',
      mock: true,
      mode: 'tags',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  nullType: {
    output: {
      schemas: '../generated/mock/null-type/model',
      target: '../generated/mock/null-type/endpoints.ts',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/null-type.yaml',
    },
  },
  enumRefs: {
    output: {
      mode: 'tags',
      schemas: '../generated/mock/enumRefs/model',
      target: '../generated/mock/enumRefs/endpoints.ts',
      client: 'axios',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/enum-refs.yaml',
    },
  },
  typelessEnum: {
    input: '../specifications/typelessEnum.yaml',
    output: {
      schemas: '../generated/mock/typelessEnum/schemas',
      target: '../generated/mock/typelessEnum',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
  },
  formats: {
    input: '../specifications/format.yaml',
    output: {
      target: '../generated/mock/formats/endpoints.ts',
      schemas: '../generated/mock/formats/model',
      mock: true,
      override: {
        useDates: true,
        useBigInt: true,
        mock: {
          fractionDigits: 1,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
  },
  zodSchemaResponse: {
    output: {
      target: '../generated/mock/zod-schema-response/endpoints.ts',
      schemas: {
        path: '../generated/mock/zod-schema-response/model',
        type: 'zod',
      },
      client: 'axios',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  allofSharedBase: {
    output: {
      target: '../generated/mock/allof-shared-base/endpoints.ts',
      schemas: '../generated/mock/allof-shared-base/model',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/allof-shared-base.yaml',
    },
  },
  circular: {
    output: {
      target: '../generated/mock/circular/endpoints.ts',
      schemas: '../generated/mock/circular/model',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/circular.yaml',
    },
  },
  recursiveDiscriminatorAllof: {
    output: {
      target: '../generated/mock/recursive-discriminator-allof/endpoints.ts',
      schemas: '../generated/mock/recursive-discriminator-allof/model',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/recursive-discriminator-allof.yaml',
    },
  },
  discriminatorOneofUnion: {
    output: {
      target: '../generated/mock/discriminator-oneof-union/endpoints.ts',
      schemas: '../generated/mock/discriminator-oneof-union/model',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/discriminator-oneof-union.yaml',
    },
  },
  discriminatorOneofAllof: {
    output: {
      target: '../generated/mock/discriminator-oneof-allof/endpoints.ts',
      schemas: '../generated/mock/discriminator-oneof-allof/model',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/discriminator-oneof-allof.yaml',
    },
  },
  discriminatorOneofAllofInherited: {
    output: {
      target:
        '../generated/mock/discriminator-oneof-allof-inherited/endpoints.ts',
      schemas: '../generated/mock/discriminator-oneof-allof-inherited/model',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/discriminator-oneof-allof-inherited.yaml',
    },
  },
  mswMixedContentUnion: {
    output: {
      target: '../generated/mock/msw-mixed-content-union/endpoints.ts',
      schemas: '../generated/mock/msw-mixed-content-union/model',
      client: 'axios',
      mock: {
        generators: [{ type: 'msw' }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/msw-mixed-content-union.yaml',
    },
  },
  mswMixedContentUnionPreferredJson: {
    output: {
      target:
        '../generated/mock/msw-mixed-content-union-preferred-json/endpoints.ts',
      schemas: '../generated/mock/msw-mixed-content-union-preferred-json/model',
      client: 'axios',
      mock: {
        generators: [{ type: 'msw', preferredContentType: 'application/json' }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/msw-mixed-content-union.yaml',
    },
  },
  mswMixedContentUnionEachHttpStatus: {
    output: {
      target:
        '../generated/mock/msw-mixed-content-union-each-status/endpoints.ts',
      schemas: '../generated/mock/msw-mixed-content-union-each-status/model',
      client: 'axios',
      mock: {
        generators: [{ type: 'msw', generateEachHttpStatus: true }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/msw-mixed-content-each-status.yaml',
    },
  },
  mockConstraints: {
    output: {
      target: '../generated/mock/mock-constraints/endpoints.ts',
      schemas: '../generated/mock/mock-constraints/model',
      mock: {
        generators: [{ type: 'msw' }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/mock-constraints.yaml',
    },
  },
  mswMixedContentUnionVendor: {
    output: {
      target: '../generated/mock/msw-mixed-content-union-vendor/endpoints.ts',
      schemas: '../generated/mock/msw-mixed-content-union-vendor/model',
      client: 'axios',
      mock: {
        generators: [{ type: 'msw' }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/msw-mixed-content-union-vendor.yaml',
    },
  },
  issue2327: {
    output: {
      target: '../generated/mock/issue-2327/endpoints.ts',
      schemas: '../generated/mock/issue-2327/model',
      client: 'axios',
      mock: {
        generators: [{ type: 'msw' }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-2327.yaml',
    },
  },
  mixedSuccessStatus: {
    output: {
      target: '../generated/mock/mixed-success-status/endpoints.ts',
      schemas: '../generated/mock/mixed-success-status/model',
      client: 'axios',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/mixed-success-status.yaml',
    },
  },
  enumsInlineTagsSplitNative: {
    output: {
      target: '../generated/mock/enums-inline-tags-split-native/endpoints.ts',
      schemas: '../generated/mock/enums-inline-tags-split-native/model',
      mode: 'tags-split',
      mock: {
        generators: [{ type: 'msw' }],
      },
      override: {
        enumGenerationType: 'enum',
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/enums-inline.yaml',
    },
  },
  mswBinaryMultiContent: {
    output: {
      target: '../generated/mock/msw-binary-multi-content/endpoints.ts',
      schemas: '../generated/mock/msw-binary-multi-content/model',
      client: 'axios',
      mock: {
        generators: [{ type: 'msw' }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/msw-binary-multi-content.yaml',
    },
  },
  petstoreFakerSchemas: {
    output: {
      target: '../generated/mock/petstore-faker-schemas/endpoints.ts',
      schemas: '../generated/mock/petstore-faker-schemas/model',
      client: 'axios',
      mock: {
        generators: [
          { type: 'faker', schemas: true, operationResponses: false },
        ],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  petstoreFakerSchemasAndOps: {
    output: {
      target: '../generated/mock/petstore-faker-schemas-and-ops/endpoints.ts',
      schemas: '../generated/mock/petstore-faker-schemas-and-ops/model',
      client: 'axios',
      mock: {
        generators: [
          { type: 'faker', schemas: true, operationResponses: true },
        ],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  stringEnumRefFakerSchemasTagsSplit: {
    output: {
      workspace: '../generated/mock/string-enum-ref-faker-schemas-tags-split/',
      target: './index.ts',
      mode: 'tags-split',
      client: 'react-query',
      mock: {
        generators: [
          { type: 'faker', schemas: true, operationResponses: true },
        ],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/faker-schemas-string-enum-ref.yaml',
    },
  },
  issue3200: {
    output: {
      target: '../generated/mock/issue-3200/endpoints.ts',
      schemas: '../generated/mock/issue-3200/model',
      client: 'axios',
      mock: {
        generators: [
          { type: 'faker', schemas: true, operationResponses: true },
        ],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3200.yaml',
    },
  },
  issue2465: {
    output: {
      target: '../generated/mock/issue-2465/endpoints.ts',
      schemas: '../generated/mock/issue-2465/model',
      client: 'fetch',
      mock: true,
      override: {
        mock: {
          properties: {
            firstName: () => faker.person.firstName(),
            lastName: () => faker.person.lastName(),
            email: () => faker.internet.email(),
          },
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-2465.yaml',
    },
  },
  issue3484: {
    output: {
      target: '../generated/mock/issue-3484/endpoints.ts',
      schemas: '../generated/mock/issue-3484/model',
      client: 'fetch',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3484.yaml',
    },
  },
  issue3525: {
    output: {
      target: '../generated/mock/issue-3525/endpoints.ts',
      schemas: '../generated/mock/issue-3525/model',
      client: 'fetch',
      mock: {
        generators: [
          { type: 'msw' },
          { type: 'faker', schemas: true, operationResponses: true },
        ],
      },
      override: {
        mock: {
          required: true,
          nonNullable: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3525.yaml',
    },
  },
  issue3525Multi: {
    output: {
      target: '../generated/mock/issue-3525-multi/endpoints.ts',
      schemas: '../generated/mock/issue-3525-multi/model',
      client: 'fetch',
      mock: {
        generators: [
          { type: 'msw' },
          { type: 'faker', schemas: true, operationResponses: true },
        ],
      },
      override: {
        mock: {
          required: true,
          nonNullable: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3525-multi.yaml',
    },
  },
  issue3525Oas31: {
    output: {
      target: '../generated/mock/issue-3525-oas31/endpoints.ts',
      schemas: '../generated/mock/issue-3525-oas31/model',
      client: 'fetch',
      mock: {
        generators: [
          { type: 'msw' },
          { type: 'faker', schemas: true, operationResponses: true },
        ],
      },
      override: {
        mock: {
          required: true,
          nonNullable: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3525-oas31.yaml',
    },
  },
  issue3525WidgetMock: {
    output: {
      target: '../generated/mock/issue-3525-widget-mock/endpoints.ts',
      schemas: '../generated/mock/issue-3525-widget-mock/model',
      client: 'fetch',
      mock: {
        generators: [{ type: 'msw' }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3525-widget-mock.yaml',
    },
  },
  issue3525WidgetMockStrict: {
    output: {
      target: '../generated/mock/issue-3525-widget-mock-strict/endpoints.ts',
      schemas: '../generated/mock/issue-3525-widget-mock-strict/model',
      client: 'fetch',
      mock: {
        generators: [{ type: 'msw' }],
      },
      override: {
        mock: {
          required: true,
          nonNullable: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3525-widget-mock.yaml',
    },
  },
  fakerArrayItems: {
    output: {
      target: '../generated/mock/faker-array-items/endpoints.ts',
      schemas: '../generated/mock/faker-array-items/model',
      client: 'axios',
      mock: {
        generators: [{ type: 'faker', arrayItems: true }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/faker-array-items.yaml',
    },
  },
  fakerArrayItemsTagsSplit: {
    output: {
      target: '../generated/mock/faker-array-items-tags-split/endpoints.ts',
      schemas: '../generated/mock/faker-array-items-tags-split/model',
      mode: 'tags-split',
      client: 'axios',
      mock: {
        generators: [{ type: 'faker', arrayItems: true }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/faker-array-items-tags-split.yaml',
    },
  },
  mswArrayItems: {
    output: {
      target: '../generated/mock/msw-array-items/endpoints.ts',
      schemas: '../generated/mock/msw-array-items/model',
      client: 'axios',
      mock: {
        generators: [{ type: 'msw', arrayItems: true, delay: false }],
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/msw-array-items.yaml',
    },
  },
  issue3574StrictMockTagsSplitAngular: {
    output: {
      target:
        '../generated/mock/issue-3574-strict-mock-tags-split/pets/pets.service.ts',
      schemas: '../generated/mock/issue-3574-strict-mock-tags-split/schemas',
      mode: 'tags-split',
      client: 'angular',
      mock: {
        indexMockFiles: true,
        generators: [
          { type: 'msw', delay: 150 },
          { type: 'faker', arrayItems: true },
        ],
      },
      override: {
        mock: {
          required: true,
          nonNullable: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3574-strict-mock-tags-split.yaml',
    },
  },
  issue3574StrictMockTagsSplitFetch: {
    output: {
      target:
        '../generated/mock/issue-3574-strict-mock-tags-split-fetch/pets/pets.ts',
      schemas:
        '../generated/mock/issue-3574-strict-mock-tags-split-fetch/schemas',
      mode: 'tags-split',
      client: 'fetch',
      mock: {
        indexMockFiles: true,
        generators: [
          { type: 'msw' },
          { type: 'faker', schemas: true, operationResponses: true },
        ],
      },
      override: {
        mock: {
          required: true,
          nonNullable: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3574-strict-mock-tags-split.yaml',
    },
  },
  issue3574StrictMockTagsSplitMultiFetch: {
    output: {
      target:
        '../generated/mock/issue-3574-strict-mock-tags-split-multi-fetch/store/store.ts',
      schemas:
        '../generated/mock/issue-3574-strict-mock-tags-split-multi-fetch/schemas',
      mode: 'tags-split',
      client: 'fetch',
      mock: {
        indexMockFiles: true,
        generators: [
          { type: 'msw' },
          { type: 'faker', schemas: true, operationResponses: true },
        ],
      },
      override: {
        mock: {
          required: true,
          nonNullable: true,
        },
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3574-strict-mock-tags-split-multi.yaml',
    },
  },
  // #3342: splitByContentType must give MSW handlers distinct names per
  // content-type variant (e.g. *WithJson / *WithFormData), otherwise the
  // generated mock file fails to compile with duplicate declarations.
  issue3342: {
    output: {
      target: '../generated/mock/issue-3342/endpoints.ts',
      schemas: '../generated/mock/issue-3342/model',
      client: 'react-query',
      mock: true,
      override: {
        splitByContentType: true,
      },
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/split-by-content-type.yaml',
    },
  },
  splitMockPath: {
    output: {
      target: '../generated/mock/split-mock-path/endpoints.ts',
      schemas: '../generated/mock/split-mock-path/model',
      mock: {
        path: '../generated/mock/split-mock-path/mocks',
        generators: [{ type: 'msw' }, { type: 'faker' }],
      },
      mode: 'split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  tagsSplitMockPath: {
    output: {
      target: '../generated/mock/tags-split-mock-path/endpoints.ts',
      schemas: '../generated/mock/tags-split-mock-path/model',
      mock: {
        path: '../generated/mock/tags-split-mock-path/mocks',
        indexMockFiles: true,
        generators: [{ type: 'msw' }, { type: 'faker' }],
      },
      mode: 'tags-split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  singleMockPath: {
    output: {
      target: '../generated/mock/single-mock-path/endpoints.ts',
      schemas: '../generated/mock/single-mock-path/model',
      mock: {
        path: '../generated/mock/single-mock-path/mocks',
        indexMockFiles: true,
        generators: [{ type: 'msw' }, { type: 'faker' }],
      },
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  tagsMockPath: {
    output: {
      target: '../generated/mock/tags-mock-path/endpoints.ts',
      schemas: '../generated/mock/tags-mock-path/model',
      mock: {
        path: '../generated/mock/tags-mock-path/mocks',
        indexMockFiles: true,
        generators: [{ type: 'msw' }, { type: 'faker' }],
      },
      mode: 'tags',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  tagsSplitPerGeneratorPath: {
    output: {
      target:
        '../generated/mock/tags-split-per-generator-path/endpoints.ts',
      schemas: '../generated/mock/tags-split-per-generator-path/model',
      mock: {
        indexMockFiles: true,
        generators: [
          {
            type: 'msw',
            path: '../generated/mock/tags-split-per-generator-path/msw',
          },
          {
            type: 'faker',
            path: '../generated/mock/tags-split-per-generator-path/faker',
          },
        ],
      },
      mode: 'tags-split',
      client: 'axios',
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/petstore.yaml',
    },
  },
  'issue-3505': {
    output: {
      target: '../generated/mock/issue-3505/endpoints.ts',
      schemas: '../generated/mock/issue-3505/model',
      client: 'axios',
      mock: true,
      clean: true,
      formatter: 'prettier',
    },
    input: {
      target: '../specifications/issue-3505.yaml',
    },
  },
});
