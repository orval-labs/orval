import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';
import transformer from './api/transformer/add-version.js';

export default defineConfig({
  'petstore-file': {
    input: './petstore.yaml',
    output: {
      target: './api/endpoints/petstoreFromFileSpecWithConfig.ts',
      prettier: true,
    },
  },
  'petstore-file-transfomer': {
    output: {
      target: './api/endpoints/petstoreFromFileSpecWithTransformer.ts',
      schemas: './api/model',
      prettier: true,
      mock: true,
      override: {
        operations: {
          listPets: {
            mutator: './api/mutator/response-type.ts',
            mock: {
              properties: () => {
                return {
                  id: faker.number.int({ min: 1, max: 9 }),
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
            '/tag|name/': 'jon',
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer,
      },
    },
  },
});
