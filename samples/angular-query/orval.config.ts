import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

export default defineConfig({
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
          /**
           * mutationInvalidates: Auto-invalidate queries when mutations succeed
           *
           * - Simple array: `createPets: ['listPets']`
           * - Multiple targets: `updatePetById: ['listPets', 'showPetById']`
           *
           * After each mutation succeeds, the specified queries are automatically
           * invalidated via queryClient.invalidateQueries(), triggering a refetch.
           */
          mutationInvalidates: {
            // After creating a pet, invalidate the pets list so it refetches
            createPets: ['listPets'],
            // After uploading a file, invalidate multiple queries
            uploadFile: ['listPets', 'showPetById'],
          },
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
});
