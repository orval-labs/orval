const transformer = require('./api/transformer/add-version.js');

module.exports = {
  'petstore-parse-date': {
    output: {
      target: './api/endpoints/petstoreFromFileSpecWithTransformer.ts',
      schemas: './api/model',
      mock: true,
      override: {
        mutator: { path: './api/mutator/response-type.ts', name: 'parseDate' },
        date: true,
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer,
      },
    },
  },
};
