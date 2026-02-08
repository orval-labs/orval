import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/api/http-client/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'src/api/model',
      client: 'angular',
      mock: { type: 'msw', indexMockFiles: true },
      tsconfig: './tsconfig.app.json',
      clean: true,
      override: {
        paramsSerializer: 'src/orval/mutator/custom-params-serializer.ts',
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
              data: () => ({
                id: faker.number.int({ min: 1, max: 99 }),
                name: faker.person.firstName(),
                tag: faker.helpers.arrayElement([
                  faker.word.sample(),
                  undefined,
                ]),
              }),
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.person.lastName(),
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'src/orval/transformer/add-version.js',
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
      clean: true,
      override: {
        angular: {
          client: 'httpResource',
        },
        paramsSerializer: 'src/orval/mutator/custom-params-serializer.ts',
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
              data: () => ({
                id: faker.number.int({ min: 1, max: 99 }),
                name: faker.person.firstName(),
                tag: faker.helpers.arrayElement([
                  faker.word.sample(),
                  undefined,
                ]),
              }),
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.person.lastName(),
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'src/orval/transformer/add-version.js',
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
      clean: true,
      override: {
        angular: {
          client: 'httpResource',
        },
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
              data: () => ({
                id: faker.number.int({ min: 1, max: 99 }),
                name: faker.person.firstName(),
                tag: faker.helpers.arrayElement([
                  faker.word.sample(),
                  undefined,
                ]),
              }),
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.person.lastName(),
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'src/orval/transformer/add-version.js',
      },
    },
  },
});
