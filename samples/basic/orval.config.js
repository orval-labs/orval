const faker = require('faker');

module.exports = {
  'petstore-file': {
    input: './petstore.yaml',
    output: './petstoreFromFileSpecWithConfig.ts',
  },
  'petstore-file-transfomer': {
    output: {
      mode: 'split',
      target: './petstoreFromFileSpecWithTransformer.ts',
      schemas: './model',
      mock: true,
      override: {
        operations: {
          listPets: {
            mutator: './mutator-response-type.js',
            mock: {
              properties: () => {
                return {
                  id: faker.random.number({ min: 1, max: 9 }),
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
            '/tag|name/': 'jon',
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: './transformer-add-version.js',
      },
    },
  },
};
