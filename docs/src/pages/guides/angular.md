---
id: angular
title: Angular
---

You should have an OpenAPI specification and an Orval config where you define the mode as Angular.

#### Example with angular

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

Checkout the [orval config](../reference/configuration/full-example) reference to see all available options.

The Angular mode will generate automatically two classes. One abstract with the definition and a service with the implementation. You should add the service inside a module and use it where you want.

You can checkout an example <a href="https://github.com/orval-labs/orval/tree/master/samples/angular-app" target="_blank">here</a>

### How to set a backend url

You can use an interceptor to automatically add the url of your API. Like you would do to add an authorization header.

### How use mock

You should define your mock inside the environment file. If you don't do that you will add all the dependencies to your bundle.

You can for example add a property `modules` and add a MockModule inside which will setup your mocks. You can check an example <a href="https://github.com/orval-labs/orval/tree/master/samples/angular-app/src/api/mocks" target="_blank">here</a>

You can also check the msw example <a href="https://github.com/mswjs/examples/tree/master/examples/rest-angular" target="_blank">here</a>
