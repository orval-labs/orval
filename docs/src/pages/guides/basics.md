---
id: basics
title: Basics
---

Start by generating or defining an OpenAPI specification (example <a href="https://github.com/orval-labs/orval/blob/master/samples/basic/petstore.yaml" target="_blank"> petstore.yaml</a>).

Then create a file `orval.config.js` at the root of your project:

## Example of orval.config.js

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

The output options configure how and where you want to write the generated code.

- `mode` specifies how files are generated (default: `single` - only one file with everything)
- `target` specifies where the generated file(s) will be written by default
- `schemas` specifies where the models will be written.
- `mock` generates mocks with the mocks generator (by default MSW). Mocks will be generated in the target file. Refer to <a href="https://mswjs.io/" target="_blank">the MSW documentation</a> to set it up correctly in your project.

The input options configure the imported specification and any optional overrides.

- `target` specifies the path to the OpenAPI specification file
- `override` specifies options to override the input specification
  - `transformer` is used to transform the specification, such as adding a parameter to every request.

Consult the [orval configuration reference](../reference/configuration/overview) to see all available options.
