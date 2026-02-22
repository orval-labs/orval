import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'split',
      target: 'src/api/endpoints/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'src/api/model',
      mock: true,
      prettier: true,
      override: {
        mutator: {
          path: 'src/api/mutator/custom-instance.ts',
          name: 'customInstance',
        },
        operations: {
          listPets: {
            mock: {
              properties: () => {
                return {
                  '[].id': () => faker.number.int({ min: 1, max: 99999 }),
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
  'petstore-file-with-docs-markdown': {
    input: './petstore.yaml',
    output: {
      target: 'src/api/endpoints/petstoreFromFileSpecWithDocsMarkdown.ts',
      prettier: true,
      docs: {
        out: './docs-markdown',
        disableSources: true,
      },
    },
  },
  'petstore-file-with-docs-html': {
    input: './petstore.yaml',
    output: {
      target: 'src/api/endpoints/petstoreFromFileSpecWithDocsHtml.ts',
      prettier: true,
      docs: {
        theme: 'default',
        out: './docs-html',
        disableSources: true,
      },
    },
  },
  'petstore-file-with-docs-options-plugin': {
    input: './petstore.yaml',
    output: {
      target: 'src/api/endpoints/petstoreFromFileSpecWithDocsHtmlPlugin.ts',
      prettier: true,
      docs: {
        theme: 'default',
        out: './docs-html-plugin',
        plugin: ['typedoc-plugin-coverage'],
        disableSources: true,
      },
    },
  },
});
