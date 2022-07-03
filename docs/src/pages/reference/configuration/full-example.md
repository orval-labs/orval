---
id: configuration-full-example
title: Full example
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
                  id: () => faker.datatype.number({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: () => ({
                id: faker.datatype.number({ min: 1, max: 99 }),
                name: faker.name.firstName(),
                tag: faker.helpers.arrayElement([
                  faker.random.word(),
                  undefined,
                ]),
              }),
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.name.lastName(),
          },
          delay: 500,
        },
      },
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
