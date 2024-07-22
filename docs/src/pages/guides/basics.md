---
id: basics
title: Basics
---

You should define a OpenAPI specification (example <a href="https://github.com/orval-labs/orval/blob/master/samples/basic/petstore.yaml" target="_blank"> petstore.yaml</a>).

And then create a file `orval.config.js` at root of your project:

#### Example of orval.config.js

```js
module.exports = {
  'petstore-file-transfomer': {
    output: {
      mode: 'single',
      target: './src/petstore.ts',
      schemas: './src/model',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

The output options configure what and where you want to write the generated code.

- `mode` is where you define the way you want to generate your files (default: `single` - only one file with everything)
- `target` is where the generated will be written by default
- `schemas` is where the models will be written.
- `mock` is when you want to generate mocks with the mocks generator (by default MSW). he will be generated in the target file. You can check <a href="https://mswjs.io/" target="_blank">MSW</a> to setup them correctly in your project.

The input options configures the imported specification and also what you want to override on it.

- `target` is the specification file
- `override` is to quickly override the input
  - `transformer` to transform the specification like add a param to every call.

Checkout the [orval configuration](../reference/configuration/overview) to see all available options.
