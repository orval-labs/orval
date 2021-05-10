module.exports = {
  'petstore-file': {
    input: './api.json',
    output: {
      mode: 'split',
      target: './api/endpoints/index.ts',
      schemas: './api/model',
    },
  },
};
