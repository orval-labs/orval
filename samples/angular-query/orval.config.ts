import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

export default defineConfig({
  petstoreNoTransformer: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints-no-transformer',
      schemas: 'src/api/model-no-transformer',
      client: 'angular-query',
      httpClient: 'angular',
      clean: true,
      override: {
        query: {
          signal: true,
        },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
  petstoreCustomInstance: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints-custom-instance',
      schemas: 'src/api/model-custom-instance',
      client: 'angular-query',
      httpClient: 'angular',
      clean: true,
      override: {
        query: {
          signal: true,
        },
        mutator: {
          path: 'src/api/mutator/custom-client-with-error.ts',
          name: 'responseType',
        },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'src/api/model',
      client: 'angular-query',
      httpClient: 'angular',
      mock: true,
      tsconfig: './tsconfig.app.json',
      clean: true,
      override: {
        query: {
          useInvalidate: true,
          signal: true,
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
        transformer: 'src/api/transformer/add-version.js',
      },
    },
  },
  petstoreZod: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints-zod',
      schemas: { path: 'src/api/model-zod', type: 'zod' },
      client: 'angular-query',
      httpClient: 'angular',
      clean: true,
      override: {
        query: {
          signal: true,
          runtimeValidation: true,
        },
      },
    },
    input: {
      target: '../../tests/specifications/petstore.yaml',
    },
  },
});
