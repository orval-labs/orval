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
          useExamples: true,
          baseUrl: 'https://petstore.swagger.io/v1',
        },
      },
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
        type: 'msw',
        delay: false,
      },
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
        const imports = [];
        const handlerName = `${verbOptions.operationId}MockHandler`;

        return {
          imports: imports,
          implementation: {
            function: '',
            handlerName: handlerName,
            handler: `const ${handlerName} = () => { return { data: { id: 1, name: "myName" } } }\n`,
          },
        };
      },
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
    },
  },
  useDates: {
    input: '../specifications/format.yaml',
    output: {
      target: '../generated/mock/useDates/endpoints.ts',
      schemas: '../generated/mock/useDates/model',
      mock: true,
      override: {
        useDates: true,
      },
    },
  },
});
