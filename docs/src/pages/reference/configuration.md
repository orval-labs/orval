---
id: configuration
title: Configuration
---

This page is a reference to the different ways of configuring your orval projects.

Using an orval-config.js configuration file, placed at the root of a project, you can provide a list of options that changes the default behaviour of the orval generated files.

Configuration options for the following are described on this page:

<div>
<table className="table-auto">
  <thead>
    <tr>
      <th className="px-4 py-2">Category</th>
      <th className="px-4 py-2">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td className="border px-4 py-2">Input</td>
      <td className="border px-4 py-2">Directly the path to the specification or the configuration of the imported specification and also what you want to override on it.
      </td>
    </tr>
    <tr className="bg-gray-100">
      <td className="border px-4 py-2">Output</td>
      <td className="border px-4 py-2">Directly the path to where you want to generate your models and HTTP calls or the configuration of what and where you want to write the generated code.</td>
    </tr>
  </tbody>
</table>
</div>

#### orval.config.js

```js
module.exports = {
  petstore: {
    input: './petstore.yaml',
    output: './petstore.ts',
  },
};
```

## Input

### target

Type: `String`.

Valid values: path or link to the specification.

```js
module.exports = {
  petstore: {
    input: {
      target: './petstore.yaml',
    },
  },
};
```

### validation

Type: `Boolean`.

Default Value: `false`.

To enforce the best quality as possible of specification, we have integrated the amazing <a href="https://github.com/IBM/openapi-validator" target="_blank">OpenAPI linter from IBM</a>. We strongly encourage you to setup your custom rules with a `.validaterc` file, you can find all useful information about this configuration <a href="https://github.com/IBM/openapi-validator/#configuration" target="_blank">here</a>.

```js
module.exports = {
  petstore: {
    input: {
      validation: true,
    },
  },
};
```

### override

Type: `Object`.

Give you the possibility to override the specification

#### override.transformer

Type: `String` or `Function`.

Valid values: path or implementation of the transformer function.

This function is executed when you generate and take in argument an <a href="https://github.com/metadevpro/openapi3-ts/blob/master/src/model/OpenApi.ts#L18" target="_blank">OpenAPIObject</a> and should return an <a href="https://github.com/metadevpro/openapi3-ts/blob/master/src/model/OpenApi.ts#L18" target="_blank">OpenAPIObject</a>.

```js
module.exports = {
  input: {
    override: {
      transformer: 'src/api/transformer/add-version.js',
    },
  },
};
```

Example of transformer <a href="https://github.com/anymaniax/orval/blob/master/samples/basic/api/transformer/add-version.js" target="_blank">here</a>

## Output

### target

Type: `String`.

Valid values: path to the file which will contains the implementation.

```js
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
    },
  },
};
```

### client

Type: `String`.

Valid values: `axios`, `angular`, `react-query`.

Default Value: `axios`.

```js
module.exports = {
  petstore: {
    output: {
      client: 'react-query',
    },
  },
};
```

### schemas

Type: `String`.

Valid values: path to the folder where you want to generate all your models.

Default Value: same as the target.

```js
module.exports = {
  petstore: {
    output: {
      schemas: './api/model',
    },
  },
};
```

### mode

Type: `String`.

Valid values: `single`, `split`, `tags`, `tags-split`.

Default Value: `single`.

```js
module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
    },
  },
};
```

#### Value: single

Use to have one file with everything

```js
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
    },
  },
};
```

```
my-app
└── src
    └── api
        └── endpoints
            └── petstore.ts
```

Here a single file petstore will be created in src with your specification implementation.

#### Value: split

Use to have definition, implementation, schemas, mock in differents files

```js
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
      mode: 'split',
    },
  },
};
```

```
my-app
└── src
    ├── petstore.definition.ts
    ├── petstore.schemas.ts
    ├── petstore.msw.ts
    └── petstore.ts
```

Here depending on the configuration, you will have multiple files named petstore with a prefix created in src.

- petstore.definition.ts
- petstore.schemas.ts
- petstore.ts
- petstore.msw.ts

For angular:

=> petstore.ts is petstore.service.ts

#### Value: tags

Use this mode if you want one file by tag. Tag is a reference of the OpenApi specification tag. If you have a `pets` tag for all your pet calls then orval will generate a file pets.ts in the target folder

```js
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
      mode: 'tags',
    },
  },
};
```

```
my-app
└── src
    ├── pets.ts
    └── petstore.schemas.ts
```

For angular:

=> petstore.ts is petstore.service.ts

If you don't use the `schemas` property only one file will be created with all the models for every tag.

#### Value: tags-split

This mode is a combination of the tags and split mode. orval will generate a folder for every tag in the target folder and split into multiple files in those folders.

```js
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
      mode: 'tags-split',
    },
  },
};
```

```
my-app
└── src
    ├── petstore.schemas.ts
    └── pets
        ├── petstore.ts
        ├── petstore.definition.ts
        ├── petstore.msw.ts
        └── petstore.ts
```

Same as the tags mode if you don't use the `schemas` property only one file will be created with all the models for every tag.

### title

Type: `String` or `Function`.

Valid values: path or implementation of the function.

```js
module.exports = {
  output: {
    override: {
      title: (title) => `${title}Api`,
    },
  },
};
```

### mock

Type: `Boolean`.

Default Value: `false`.

Will generate your mock using <a href="https://github.com/marak/Faker.js/" target="_blank">faker</a> and <a href="https://mswjs.io/" target="_blank">msw</a>

```js
module.exports = {
  petstore: {
    output: {
      mock: true,
    },
  },
};
```

### override

Type: `Object`.

Give you the possibility to override the output like your mock implementation or transform the API implementation like you want

#### override.transformer

Type: `String` or `Function`.

Valid values: path or implementation of the transformer function.

This function is executed for each call when you generate and take in argument a <a href="https://github.com/anymaniax/orval/blob/master/src/types/generator.ts#L40" target="_blank">VerbOptions</a> and shouled return a <a href="https://github.com/anymaniax/orval/blob/master/src/types/generator.ts#L40" target="_blank">VerbOptions</a>

```js
module.exports = {
  input: {
    override: {
      transformer: 'src/yourfunction.js',
    },
  },
};
```

#### override.mutator

Type: `String` or `Object`.

Valid values: path of the mutator function or object with a path and name.

If you provide an object you can also add a default property to use an export default function.

This function is executed for each call when this one is executed. It takes all the options passed to the verb as an argument and should return a promise with your custom implementation or prefered HTTP client.

Possible arguments:

- The first argument will be an object with the following type.

```ts
// based on AxiosRequestConfig
interface RequestConfig {
  method: 'get' | 'put' | 'patch' | 'post' | 'delete';
  url: string;
  params?: any;
  data?: any;
  responseType?: string;
}
```

- The second is only provided for the angular client and give an instance of HttpClient

Example:

```js
module.exports = {
  input: {
    override: {
      mutator: {
        path: './api/mutator/custom-instance.ts',
        name: 'customInstance',
        // default: true
      },
    },
  },
};
```

```ts
// custom-instance.ts

import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({ ...config, cancelToken: source.token }).then(
    ({ data }) => data,
  );

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled by React Query');
  };

  return promise;
};
```

#### override.query

Type: `Object`.

Give you the possibility to override the generated <a href="https://react-query.tanstack.com/" target="_blank">query</a>

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        query: {
          useQuery: true,
          usePaginated: true,
          useInfinite: true,
          useInfiniteQueryParam: 'nextId',
          config: {
            staleTime: 10000,
          },
        },
      },
    },
    ...
  },
};
```

#### override.query.useQuery

Type: `Boolean`.

Use to generate a <a href="https://react-query.tanstack.com/docs/api#usequery" target="_blank">useQuery</a> custom hook. If the query key isn't provided that's the default hook generated.

#### override.query.usePaginated

Type: `Boolean`.

Use to generate a <a href="https://react-query.tanstack.com/docs/api#usepaginatedquery" target="_blank">usePaginatedQuery</a> custom hook.

#### override.query.useInfinite

Type: `Boolean`.

Use to generate a <a href="https://react-query.tanstack.com/docs/api#useinfinitequery" target="_blank">useInfiniteQuery</a> custom hook.

#### override.query.useInfiniteQueryParam

Type: `String`.

Use to automatically add to the request the query param provided by the useInfiniteQuery when you use `getFetchMore` function.

#### override.query.config

Type: `Object`.

Use to override the query config. Check available options <a href="https://react-query.tanstack.com/docs/api#usequery" target="_blank">here</a>

#### override.mock

Type: `Object`.

Give you the possibility to override the generated mock

#### override.mock.properties

Type: `Object` or `Function`.

You can use this to override the generated mock per property. Properties can take a function who take the specification in argument and should return un object or directly the object. Each key of this object can be a regex or directly the name of the property to override and the value can be a function which return the wanted value or directly the value. If you use a function this will be executed at runtime.

```js
module.exports = {
  input: {
    override: {
      mock: {
        properties: {
          '/tag|name/': 'jon',
          email: () => faker.internet.email(),
        },
      },
    },
  },
};
```

#### override.operations

Type: `Object`.

Give you the possibility to override the generated mock by <a href="https://swagger.io/docs/specification/paths-and-operations/" target="_blank">operationId</a>.

Each key of the object should be an operationId and take as value an object.

The value object can take the same properties as the override property (mutator,query,transformer,mock).

The mock options have one more possibility the data property. Which can take a function or the value directly. The function will be executed at runtime.

```js
module.exports = {
  input: {
    override: {
      operations: {
        listPets: {
          transformer: 'src/yourfunction.js',
          mutator: 'src/response-type.js',
          mock: {
            properties: () => {
              return {
                id: () => faker.random.number({ min: 1, max: 99999 }),
              };
            },
          },
        },
        showPetById: {
          mock: {
            data: () => ({
              id: faker.random.number({ min: 1, max: 99 }),
              name: faker.name.firstName(),
              tag: faker.helpers.randomize([faker.random.word(), undefined]),
            }),
          },
        },
      },
    },
  },
};
```

#### override.tags

Type: `Object`.

Exactly the same as the `override.operations` but this time you can do it by <a href="https://swagger.io/docs/specification/grouping-operations-with-tags/" target="_blank">tags</a>

## Full example

```js
const faker = require('faker');

module.exports = {
  petstore: {
    output: {
      mode: 'split',
      target: 'src/petstore.ts',
      schemas: 'src/model',
      client: 'react-query',
      mock: true,
      override: {
        operations: {
          listPets: {
            mutator: 'src/response-type.js',
            mock: {
              properties: () => {
                return {
                  id: () => faker.random.number({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: () => ({
                id: faker.random.number({ min: 1, max: 99 }),
                name: faker.name.firstName(),
                tag: faker.helpers.randomize([faker.random.word(), undefined]),
              }),
            },
          },
        },
        mock: {
          properties: {
            '/tag|name/': () => faker.name.lastName(),
          },
        },
      },
    },
    input: {
      target: './petstore.yaml',
      override: {
        transformer: 'src/add-version.js',
      },
    },
  },
};
```
