---
id: configuration-full-example
title: Full Example
---

```js
const { faker } = require('@faker-js/faker');

module.exports = {
  petstore: {
    output: {
      mode: 'split',
      target: 'src/petstore.ts',
      schemas: 'src/model',
      client: 'react-query',
      mock: true,
      override: {
        operations: {
          listPets: {
            mutator: 'src/response-type.js',
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
          delay: 500,
        },
      },
      allParamsOptional: true,
      urlEncodeParameters: true,
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'src/add-version.js',
      },
    },
    hooks: {
      afterAllFilesWrite: 'prettier --write',
    },
  },
};
```
