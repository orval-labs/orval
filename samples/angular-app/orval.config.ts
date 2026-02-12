import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';
import transformer from './src/orval/transformer/add-version';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'src/api/model',
      client: 'angular',
      /**
       * Workaround for mixed JSON/XML mock payload mismatch.
       *
       * See: https://github.com/orval-labs/orval/issues/2950
       */
      mock: {
        type: 'msw',
        indexMockFiles: true,
        preferredContentType: 'application/json',
      },
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
        transformer,
      },
    },
  },
});
