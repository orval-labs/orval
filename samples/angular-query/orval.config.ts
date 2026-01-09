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
});
