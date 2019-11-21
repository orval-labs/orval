/**
 * Example config for `yarn example:advanced`
 */

module.exports = {
  'petstore-file': {
    file: 'examples/petstore.yaml',
    output: 'examples/petstoreFromFileSpecWithConfig.tsx',
    types: './model',
    defaultParams: {
      version: {
        path: '/v',
        default: 1,
        type: 'number',
      },
    },
  },
};
