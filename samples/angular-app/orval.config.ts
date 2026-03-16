import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

const createValidPhone = () =>
  faker.helpers.arrayElement([
    `+1${faker.string.numeric({ length: 10 })}`,
    undefined,
  ]);

const createShowPetMock = () => ({
  id: faker.number.int({ min: 1, max: 99 }),
  name: faker.person.firstName(),
  tag: faker.helpers.arrayElement([faker.word.sample(), undefined]),
  status: faker.helpers.arrayElement(['available', 'pending', 'sold'] as const),
  requiredNullableString: null,
  optionalNullableString: faker.helpers.arrayElement([
    faker.word.sample(),
    null,
    undefined,
  ]),
  phone: faker.helpers.arrayElement([
    `+1${faker.string.numeric({ length: 10 })}`,
    undefined,
  ]),
});

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/api/http-client/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'src/api/model',
      client: 'angular',
      mock: { type: 'msw', indexMockFiles: true },
      tsconfig: './tsconfig.app.json',
      prettier: true,
      clean: true,
      override: {
        operations: {
          listPets: {
            mutator: 'src/orval/mutator/response-type.ts',
            mock: {
              properties: () => {
                return {
                  id: () => faker.number.int({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: createShowPetMock,
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.person.lastName(),
            '/phone/': createValidPhone,
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'orval/transformer/add-version.ts',
      },
    },
  },
  petstoreCustomParamsSerializer: {
    output: {
      mode: 'tags-split',
      target: 'src/api/http-client-custom-params/petstore.ts',
      schemas: 'src/api/model-custom-params',
      client: 'angular',
      mock: { type: 'msw', indexMockFiles: true },
      tsconfig: './tsconfig.app.json',
      prettier: true,
      clean: true,
      override: {
        paramsSerializer: 'src/orval/mutator/custom-params-serializer.ts',
        operations: {
          listPets: {
            mock: {
              properties: () => {
                return {
                  id: () => faker.number.int({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: createShowPetMock,
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.person.lastName(),
            '/phone/': createValidPhone,
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'orval/transformer/add-version.ts',
      },
    },
  },
  petstoreZod: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints-zod/petstore.ts',
      schemas: {
        type: 'zod',
        path: 'src/api/model-zod',
      },
      client: 'angular',
      mock: { type: 'msw', indexMockFiles: true },
      tsconfig: './tsconfig.app.json',
      prettier: true,
      clean: true,
      override: {
        angular: {
          runtimeValidation: true,
        },
        operations: {
          listPets: {
            mock: {
              properties: () => {
                return {
                  id: () => faker.number.int({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: createShowPetMock,
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.person.lastName(),
            '/phone/': createValidPhone,
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'orval/transformer/add-version.ts',
      },
    },
  },
  petstoreHttpResource: {
    output: {
      mode: 'tags-split',
      target: 'src/api/http-resource/petstore.ts',
      schemas: 'src/api/model',
      client: 'angular',
      mock: { type: 'msw', indexMockFiles: true },
      tsconfig: './tsconfig.app.json',
      prettier: true,
      clean: true,
      override: {
        angular: {
          client: 'httpResource',
        },
        operations: {
          listPets: {
            // Note: response-type mutator is HttpClient-specific (requires HttpClient
            // as second arg) and is incompatible with httpResource. Omitted here.
            mock: {
              properties: () => {
                return {
                  id: () => faker.number.int({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: createShowPetMock,
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.person.lastName(),
            '/phone/': createValidPhone,
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'orval/transformer/add-version.ts',
      },
    },
  },
  petstoreHttpResourceZod: {
    output: {
      mode: 'tags-split',
      target: 'src/api/http-resource-zod/petstore.ts',
      schemas: {
        type: 'zod',
        path: 'src/api/model-zod',
      },
      client: 'angular',
      mock: { type: 'msw', indexMockFiles: true },
      tsconfig: './tsconfig.app.json',
      prettier: true,
      clean: true,
      override: {
        angular: {
          client: 'httpResource',
          runtimeValidation: true,
        },
        operations: {
          listPets: {
            mock: {
              properties: () => {
                return {
                  id: () => faker.number.int({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: createShowPetMock,
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.person.lastName(),
            '/phone/': createValidPhone,
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'orval/transformer/add-version.ts',
      },
    },
  },
});
