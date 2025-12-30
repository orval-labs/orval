import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'src/api/model',
      client: 'angular',
      mock: { indexMockFiles: true },
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
        transformer: 'src/orval/transformer/add-version.ts',
      },
    },
  },
});
