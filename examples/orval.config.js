const faker = require('faker');
/**
 * Example config for `yarn example:advanced`
 */

module.exports = {
  'petstore-file': {
    input: 'examples/petstore.yaml',
    output: 'examples/petstoreFromFileSpecWithConfig.ts'
  },
  'petstore-file-transfomer': {
    output: {
      target: 'examples/petstoreFromFileSpecWithTransformer.ts',
      schemas: 'examples/model',
      mock: true,
      override: {
        operations: {
          listPets: {
            transformer: 'examples/transformer-response-type.js',
            mock: {
              properties: () => {
                return {
                  id: faker.random.number({min: 1, max: 9})
                };
              }
            }
          },
          showPetById: {
            mock: {
              data: () => ({
                id: faker.random.number({min: 1, max: 99}),
                name: faker.name.firstName(),
                tag: faker.helpers.randomize([faker.random.word(), undefined])
              })
            }
          }
        },
        mock: {
          properties: {
            '/tag|name/': 'jon'
          }
        }
      }
    },
    input: {
      target: 'examples/petstore.yaml',
      override: {
        transformer: 'examples/transformer-add-version.js'
      }
    }
  }
};
