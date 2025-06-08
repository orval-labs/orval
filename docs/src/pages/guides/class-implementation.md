---
id: class-implementation
title: Class Implementation
---

You should have an OpenAPI specification and an Orval config where you define the mode as Class.

#### Example with angular

```js
module.exports = {
  petstore: {
    output: {
      implementationFormat: 'class',
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

Checkout the [orval config](../reference/configuration/full-example) reference to see all available options.

Class implementation format will generate the client as a JavaScript class, that takes Axios instance as a constructor parameter. If no parameter is provided, global Axios instance will be set as default.

Currently only Axios client is supported.

You can checkout an example <a href="https://github.com/orval-labs/orval/tree/master/samples/basic" target="_blank">here</a>
