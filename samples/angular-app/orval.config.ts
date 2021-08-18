import * as faker from 'faker';
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'src/api/model',
      client: 'angular',
      mock: true,
      override: {
        operations: {
          listPets: {
            mutator: 'src/api/mutator/response-type.ts',
            mock: {
              properties: () => {
                return {
                  id: () => faker.random.number({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: () => ({
                id: faker.random.number({ min: 1, max: 99 }),
                name: faker.name.firstName(),
                tag: faker.helpers.randomize([faker.random.word(), undefined]),
              }),
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.name.lastName(),
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
