---
id: angular
title: Angular
---

Start by providing an OpenAPI specification and an Orval config file. To use Angular, define the `mode` in the Orval config to be `angular`.

## Example with angular

```js
module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/petstore.ts',
      schemas: 'src/model',
      client: 'angular',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

Navigate to the [Orval config reference](../reference/configuration/full-example) to see all available options.

The Angular client will automatically generate two classes:

1. An abstract class with the definition
2. A service with the implementation.
   Add the service inside a module to use it where you need it.

Check out an example <a href="https://github.com/orval-labs/orval/tree/master/samples/angular-app" target="_blank">here</a>

## How to Set a Backend URL

Use an interceptor to automatically add an API URL, similar to how an authorization header is added.

<!--
The following section is outdated. Both links are dead. This needs to be updated before it is re-introduced.

 ## How to Use Mocks

You should define your mock inside the environment file. If you don't do that you will add all the dependencies to your bundle.

You can for example add a property `modules` and add a MockModule inside which will setup your mocks. You can check an example <a href="https://github.com/orval-labs/orval/tree/master/samples/angular-app/src/api/mocks" target="_blank">here</a>

You can also check the msw example <a href="https://github.com/mswjs/examples/tree/master/examples/rest-angular" target="_blank">here</a> -->
