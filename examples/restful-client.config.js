/**
 * Example config for `yarn example:advanced`
 */

module.exports = {
  'petstore-file': {
    file: 'examples/petstore.yaml',
    output: 'examples/petstoreFromFileSpecWithConfig.tsx',
    types: 'examples/model',
  },
  'petstore-file-transfomer': {
    file: 'examples/petstore.yaml',
    output: 'examples/petstoreFromFileSpecWithTransformer.tsx',
    types: 'examples/model',
    transformer: 'examples/transformer-add-version.js',
  },
};
