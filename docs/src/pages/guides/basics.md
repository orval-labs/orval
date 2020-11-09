---
id: basics
title: Basics
---

You should define a OpenApi specification like [this](https://github.com/anymaniax/orval/blob/master/samples/basic/petstore.yaml)

And then create a file orval.config.js at root of your project.

#### Example of orval.config.js

```js
module.exports = {
  'petstore-file-transfomer': {
    output: {
      mode: 'single',
      target: 'src/api/endpoints/petstoreFromFileSpec.ts',
      schemas: './api/model',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

The output options configure what and where you want to write the generated code.

- mode is where you define the way you want to generate your files (default: single - is only one file with everything)
- target is where the generated will be write by default
- schemas is where the models will be write.
- mock is when you want to generate mocks with MSW. Rhe will be generated in the target file. You can check [here](https://mswjs.io/) to setup them correctly

The input options configure the imported specification and also what you want to override on it.

- target is the specification file
- override is to quickly override the input
  - transformer to transform the specification like add a param to every call.

Checkout the [orval config](../reference/orval-config) reference to see all available options.
