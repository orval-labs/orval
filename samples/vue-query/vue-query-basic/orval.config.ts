import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'split',
      target: 'src/api/endpoints/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'src/api/model',
      client: 'vue-query',
      httpClient: 'axios',
      mock: true,
      prettier: true,
      override: {
        mutator: {
          path: './src/api/mutator/custom-instance.ts',
          name: 'customInstance',
        },
        operations: {
          listPets: {
            mock: {
              properties: () => ({
                '[].id': () => faker.number.int({ min: 1, max: 99999 }),
              }),
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
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'limit',
        },
      },
      allParamsOptional: true, // TODO: this this not a default, maybe consider creating a separate sample to test default behaviour still works; There is a generated test tho (same as named-params for other clients)
      urlEncodeParameters: true, // TODO: this this not a default, maybe consider creating a separate sample to test default behaviour still works; There is a generated test tho (same as named-params for other clients)
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: './src/api/transformer/add-version.js',
      },
    },
  },
});
