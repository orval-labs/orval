---
id: configuration-output
title: Output
---

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

Type: `String | Function`.

Valid values: `angular`, `axios`, `axios-functions`, `react-query`, `svelte-query`, `vue-query`, `swr`, `zod`, `fetch`.

Default Value: `axios-functions`.

```js
module.exports = {
  petstore: {
    output: {
      client: 'react-query',
    },
  },
};
```

If you want you can provide a function to extend or create you custom client generator and this function receive a [GeneratorClients](https://github.com/orval-labs/orval/blob/master/packages/core/src/types.ts#L156) in argument and should return a [ClientGeneratorsBuilder](https://github.com/orval-labs/orval/blob/master/packages/core/src/types.ts#L652).

### httpClient

Type: `String`.

Valid values: `fetch`, `axios`.

Default Value: `axios`.

```js
module.exports = {
  petstore: {
    output: {
      client: 'swr',
      httpClient: 'fetch',
    },
  },
};
```

If you want you can use the `fetch` API as an http client by specifying `fetch` in the `httpClient` option.
`httpClient` only available when `swr`, `react-query`, `vue-query`, and `svelte-query` are specified as the `client` option.

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

### fileExtension

Type: `String`.

Default Value: `.ts`.

Specify the file extension for files generated automatically. Modes such as `tags`, `tags-split`, and `split` do not alter `schema` files; they only pertain to `client` files.

```js
module.exports = {
  petstore: {
    output: {
      mode: 'split'
      target: './/gen/endpoints',
      schemas: './gen/model',
      fileExtension: '.gen.ts'
    },
  },
};
```

```
src/gen/
├── endpoints
│   └── swaggerPetstore.gen.ts
└── model
    ├── listPetsParams.ts
    └── pets.ts
```

### workspace

Type: `String`.

Valid values: path to the folder which will contains all the generated files. This value will be use as a base for all the other path used in the orval config.

If you provide this option, an `index.ts` file will be also created with all the available exports

```js
module.exports = {
  petstore: {
    output: {
      workspace: 'src/'
      target: './petstore.ts',
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
      mock: true,
    },
  },
};
```

```
my-app
└── src
    └── petstore.ts
```

Here a single file petstore will be created in src with your specification implementation.

#### Value: split

Use to have implementation, schemas, mock in different files

```js
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
      mock: true,
      mode: 'split',
    },
  },
};
```

```
my-app
└── src
    ├── petstore.schemas.ts
    ├── petstore.msw.ts
    └── petstore.ts
```

Here depending on the configuration, you will have multiple files named petstore with a prefix created in src.

- petstore.schemas.ts
- petstore.ts
- petstore.msw.ts

For Angular:

=> petstore.ts is petstore.service.ts

#### Value: tags

Use this mode if you want one file by tag. Tag is a reference of the OpenAPI specification tag. If you have a `pets` tag for all your pet calls then Orval will generate a file pets.ts in the target folder

```js
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
      mock: true,
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

For Angular:

=> petstore.ts is petstore.service.ts

If you don't use the `schemas` property only one file will be created with all the models for every tag.

#### Value: tags-split

This mode is a combination of the tags and split mode. Orval will generate a folder for every tag in the target folder and split into multiple files in those folders.

```js
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
      mock: true,
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
        ├── petstore.msw.ts
        └── petstore.ts
```

Same as the tags mode if you don't use the `schemas` property only one file will be created with all the models for every tag.

### indexFiles

Type: `Boolean`

Valid values: true or false. Defaults to true.

Specify whether to place `index.ts` in `schemas` generation.

Example:

```js
module.exports = {
  petstore: {
    output: {
      schemas: 'src/gen/model',
      indexFiles: false,
    },
  },
};
```

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

Type: `Boolean | Object | Function`.

Default Value: `false`.

Will generate your mock using <a href="https://github.com/faker-js/faker" target="_blank">faker</a> and <a href="https://mswjs.io/" target="_blank">msw</a> by default (if value set to true).

```js
module.exports = {
  petstore: {
    output: {
      mock: true,
    },
  },
};
```

The mock options can take some properties to customize the generation if you set it to an object. If you set it to `true`, the default options will be used. The default options are:

```js
module.exports = {
  petstore: {
    output: {
      mock: {
        type: 'msw',
        delay: 1000,
        useExamples: false,
      },
    },
  },
};
```

If you want you can provide a function to extend or create you custom mock generator and check [here](https://github.com/orval-labs/orval/blob/master/src/types/generator.ts#L132) the type.

To discover all the available options, read below.

#### type

Type: `String`.

Default Value: `msw`.

Valid values: `msw`, `cypress` (coming soon).

Use to specify the mock type you want to generate.

#### delay

Type: `Number | Function | false`.

Default Value: `1000`.

Use to specify the delay time for the mock. It can either be a fixed number, false or a function that returns a number.
Setting delay to false removes the delay call completely.

#### delayFunctionLazyExecute

Type: `boolean`.

Gives you the possibility to have functions that are passed to `delay` to be
executed at runtime rather than when the mocks are generated.

#### useExamples

Type: `Boolean`.

Gives you the possibility to use the `example`/`examples` fields from your OpenAPI specification as mock values.

#### generateEachHttpStatus

Type: `Boolean`.

Gives you the possibility to generate mocks for all the HTTP statuses in the `responses` fields in your OpenAPI specification. By default only the 200 OK response is generated.

#### baseUrl

Type: `String`.

Give you the possibility to set base url to your mock handlers.

#### locale

Type: `String`.

Default Value: `en`.

Give you the possibility to set the locale for the mock generation. It is used by faker, see the list of available options [here](https://fakerjs.dev/guide/localization.html#available-locales). It should also be strongly typed using `defineConfig`.

### clean

Type: `Boolean | String[]`.

Default Value: `false`.

Can be used to clean generated files. Provide an array of glob if you want to customize what is deleted.

Be careful clean all output target and schemas folder.

### prettier

Type: `Boolean`.

Default Value: `false`.

Can be used to prettier generated files. You need to have prettier in your dependencies.

### tslint

Type: `Boolean`.

Default Value: `false`.

Can be used to specify `tslint` ([TSLint is deprecated in favour of eslint + plugins](https://github.com/palantir/tslint#tslint)) as typescript linter instead of `eslint`. You need to have tslint in your dependencies.

### biome

Type: `Boolean`.

Default Value: `false`.

You can apply `lint` and `format` of [`biome`](https://biomejs.dev/) to the generated file. You need to have `@biomejs/biome` in your dependencies.

The automatically generated source code does not comply with some lint rules included in the default ruleset for `biome`, so please control them in the your `biome` configuration file.

### headers

Type: `Boolean`.

Use to enable the generation of the headers

### tsconfig

Type: `String | Tsconfig`.

Should be automatically found and transparent for you.
Can be used to specify the path to your `tsconfig` or directly your config.

### packageJson

Type: `String`.

Should be automatically found and transparent for you.
Can be used to specify the path to your `package.json`.

### override

Type: `Object`.

Give you the possibility to override the output like your mock implementation or transform the API implementation like you want

#### transformer

Type: `String` or `Function`.

Valid values: path or implementation of the transformer function.

This function is executed for each call when you generate and take in argument a <a href="https://github.com/orval-labs/orval/blob/master/packages/core/src/types.ts#L556" target="_blank">GeneratorVerbOptions</a> and should return a <a href="https://github.com/orval-labs/orval/blob/master/packages/core/src/types.ts#L556" target="_blank">GeneratorVerbOptions</a>

```js
module.exports = {
  petstore: {
    output: {
      override: {
        transformer: 'src/yourfunction.js',
      },
    },
  },
};
```

#### mutator

Type: `String` or `Object`.

Valid values: path of the mutator function or object with a path and name.

If you provide an object you can also add a default property to use an export default function.

This function is executed for each call when this one is executed. It takes all the options passed to the verb as an argument and should return a promise with your custom implementation or preferred HTTP client.

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

- The second argument is only provided for the Angular client and give an instance of HttpClient

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mutator: {
          path: './api/mutator/custom-instance.ts',
          name: 'customInstance',
          // default: true
        },
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

// In some case with react-query and swr you want to be able to override the return error type so you can also do it here like this
export type ErrorType<Error> = AxiosError<Error>;
```

- If your file have some alias you will also need to define them in the mutator object.

Example:

```ts
// custom-instance.ts

import Axios, { AxiosRequestConfig } from 'axios';
import config from '@config';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '', ...config });

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

export type ErrorType<Error> = AxiosError<Error>;
```

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mutator: {
          path: './api/mutator/custom-instance.ts',
          name: 'customInstance',
          alias: {
            '@config': path.resolve(_dirname, './src/config'),
          },
        },
      },
    },
  },
};
```

- If you use one of the following clients `react-query`, `vue-query` and `svelte-query`. You can also provide a hook like this

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mutator: {
          path: './api/mutator/use-custom-instance.ts',
          name: 'useCustomInstance',
          // default: true
        },
      },
    },
  },
};
```

```ts
// use-custom-instance.ts

import Axios, { AxiosRequestConfig } from 'axios';
import { useQueryClient } from 'react-query';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const useCustomInstance = <T>(): ((
  config: AxiosRequestConfig,
) => Promise<T>) => {
  const token = useToken(); // Do what you want

  return (config: AxiosRequestConfig) => {
    const source = Axios.CancelToken.source();
    const promise = AXIOS_INSTANCE({
      ...config,
      headers: {
        Authorization: `Bearer ${token}`
      }
      cancelToken: source.token,
    }).then(({ data }) => data);

    // @ts-ignore
    promise.cancel = () => {
      source.cancel('Query was cancelled by React Query');
    };

    return promise;
  };
};

export default useCustomInstance;

export type ErrorType<Error> = AxiosError<Error>;
```

#### header

Type: `Boolean | Function`.

Default Value: `true`.

Use this property to disable the auto generation of the file header

You can provide a function to customize the way you want the generate the file header. You will receive the info object of the specification in argument and you should return an array of string.

```ts
module.exports = {
  petstore: {
    output: {
      override: {
        header: (info: InfoObject): String[] => [
          `Generated by orval 🍺`,
          `Do not edit manually.`,
          ...(info.title ? [info.title] : []),
          ...(info.description ? [info.description] : []),
          ...(info.version ? [`OpenAPI spec version: ${info.version}`] : []),
        ],
      },
    },
  },
};
```

#### fetch

Type: `Object`.

Give options to the generated `fetch` client.

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        fetch: {
          includeHttpStatusReturnType: false,
        },
      },
    },
    ...
  },
};
```

##### includeHttpStatusReturnType

Type: `Boolean`.
Default: `true`

When using `fetch` for `client` or `httpClient`, the `fetch` response type includes http status for easier processing by the application.
If you want to return a defined return type instead of an automatically generated return type, set this value to `false`.

#### query

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
          useInfinite: true,
          useInfiniteQueryParam: 'nextId',
          options: {
            staleTime: 10000,
          },
          signal: true
        },
      },
    },
    ...
  },
};
```

##### useQuery

Type: `Boolean`.

Use to generate a <a href="https://tanstack.com/query/latest/docs/react/reference/useQuery" target="_blank">useQuery</a> custom hook. If the query key isn't provided that's the default hook generated.

##### useMutation

Type: `Boolean`.

Use to generate a <a href="https://tanstack.com/query/latest/docs/react/reference/useMutation" target="_blank">useMutation</a> custom hook.

##### useInfinite

Type: `Boolean`.

Use to generate a <a href="https://tanstack.com/query/latest/docs/react/reference/useInfiniteQuery" target="_blank">useInfiniteQuery</a> custom hook.

##### usePrefetch

Type: `Boolean`.

Use to generate a <a href="https://tanstack.com/query/v4/docs/react/guides/prefetching" target="_blank">prefetching</a> functions.
This may be useful for the NextJS SSR or any prefetching situations.

Example generated function:

```js
export const prefetchGetCategories = async <
  TData = Awaited<ReturnType<typeof getCategories>>,
  TError = ErrorType<unknown>,
>(
  queryClient: QueryClient,
  options?: {
    query?: UseQueryOptions<
      Awaited<ReturnType<typeof getCategories>>,
      TError,
      TData,
    >,
    request?: SecondParameter<typeof customAxiosInstance>,
  },
): Promise<QueryClient> => {
  const queryOptions = getGetCategoriesQueryOptions(options);

  await queryClient.prefetchQuery(queryOptions);

  return queryClient;
};
```

##### useInfiniteQueryParam

Type: `String`.

Use to automatically add to the request the query param provided by the useInfiniteQuery when you use `getFetchMore` function.

##### options (deprecated use queryOptions instead)

Type: `Object`.

Use to override the query config. Check available options <a href="https://tanstack.com/query/latest/docs/react/reference/useQuery" target="_blank">here</a>

##### queryKey

Type: `String` or `Object`.

Valid values: path of the `queryKey` function or object with a path and name.

If you provide an object you can also add a default property to use an export default function.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        query: {
          queryKey: {
            path: './api/query/custom-query-key.ts',
            name: 'customQueryKeyFn',
            // default: true
          },
        },
      },
    },
  },
};
```

##### queryOptions

Type: `String` or `Object`.

Valid values: path of the `queryOptions` function or object with a path and name.

If you provide an object you can also add a default property to use an export default function.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        query: {
          queryOptions: {
            path: './api/query/custom-query-options.ts',
            name: 'customQueryOptionsFn',
            // default: true
          },
        },
      },
    },
  },
};
```

##### mutationOptions

Type: `String` or `Object`.

Valid values: path of the `mutationOptions` function or object with a path and name.

If you provide an object you can also add a default property to use an export default function.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        query: {
          mutationOptions: {
            path: './api/mutator/custom-mutator-options.ts',
            name: 'customMutatorOptionsFn',
            // default: true
          },
        },
      },
    },
  },
};
```

##### signal

Type: `Boolean`.

Use to remove the generation of the abort signal provided by <a href="https://react-query.tanstack.com/" target="_blank">query</a>

##### shouldExportMutatorHooks

Type: `Boolean`.

Default Value: `true`.

Use to stop the export of mutator hooks. Useful if you want to rely soley on useQuery, useSuspenseQuery, etc.

##### version

Type: `number`.

Default Value: `Detect from package json`.

Use to specify a version for the generated hooks. This is useful if you want to force a version for the hooks.

#### angular

Type: `Object`.

Give you specific options for the angular client

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        angular: {
          provideIn: 'any',
        },
      },
    },
    ...
  },
};
```

##### provideIn

Type: `Boolean` or `String`.

Valid values: `true`, `false`, `'root'`, `'any'`, `''`.

Default Value: `'root'`.

Can be used to set the value of `providedIn` on the generated Angular services. If `false`, no `providedIn` will be set. If `true` or not specified, it will fall back to the default value: `root`.

#### swr

Type: `Object`.

Give options to the generated `swr` client. It is also possible to extend the generated functions.

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        swr: {
          useInfinite: true,
        },
      },
    },
    ...
  },
};
```

##### useInfinite

Type: `Boolean`.

Use to generate a <a href="https://swr.vercel.app/docs/pagination#useswrinfinite" target="_blank">useSWRInfinite</a> custom hook.

##### swrOptions

Type: `Object`.

Use to override the `useSwr` options. Check available options [here](https://swr.vercel.app/docs/api#options)

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        swr: {
          swrOptions: {
            dedupingInterval: 10000,
          },
        },
      },
    },
  },
};
```

##### swrMutationOptions

Type: `Object`.

Use to override the `useSWRMutation` options. Check available options [here](https://swr.vercel.app/docs/mutation#useswrmutation-parameters)

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        swr: {
          swrMutationOptions: {
            revalidate: true,
          },
        },
      },
    },
  },
};
```

##### swrInfiniteOptions

Type: `Object`.

Use to override the `useSWRInfinite` options. Check available options [here](https://swr.vercel.app/docs/pagination#parameters)

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        swr: {
          swrInfiniteOptions: {
            initialSize: 10,
          },
        },
      },
    },
  },
};
```

#### zod

Type: `Object`.

Give you specific options for the zod client

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        zod: {
          strict: {
            response: true,
            query: true,
            param: true,
            header: true,
            body: true
          },
          coerce: {
            response: true,
              query: true,
              param: true,
              header: true,
              body: true
          },
        },
      },
    },
    ...
  },
};
```

##### strict

Type: `Object`.

Default Value: `false`.

Use to set the strict mode for the zod schema. If you set it to true, the schema will be generated with the strict mode.

##### generate

Type: `Object`.

Default Value: `true`.

Use to set the which type of schemas you want to generate for the zod schema.

example:

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        zod: {
          generate: {
            param: true,
            body: true,
            response: false,
            query: true,
            header: true,
          }
        },
      },
    },
    ...
  },
};
```

In the above example exclude response body validations not generated

##### coerce

Type: `Object`.

Default Value: `false`.

Use to set the coerce for the zod schema. If you set it to true, the schema will be generated with the coerce on possible types.

You can also provide an array of coerce types to only generate the coerce types for the specified types.

example:

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        zod: {
          coerce: {
            response: [ 'boolean'],
            query: ['string', 'number', 'boolean', 'bigint', 'date'],
          }
        },
      },
    },
    ...
  },
};
```

##### preprocess

Type: `Object`.

Use to add preprocess function to a zod schema. You can use a custom mutator to preprocess the data before it is validated.

example:

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        zod: {
          preprocess: {
            response: {
              name: 'stripNill',
              path: './src/mutators.ts',
            },
          },
        },
      },
    },
    ...
  },
};
```

##### generateEachHttpStatus

Type: `Boolean`.

Gives you the possibility to generate mocks for all the HTTP statuses in the `responses` fields in your OpenAPI specification. By default only the 200 OK response is generated.

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        zod: {
          generateEachHttpStatus: true,
        },
      },
    },
    ...
  },
};
```

#### mock

Type: `Object`.

Give you the possibility to override the generated mock

##### properties

Type: `Object` or `Function`.

You can use this to override the generated mock per property. Properties can take a function who take the specification in argument and should return un object or directly the object. Each key of this object can be a regex or directly the path of the property to override and the value can be a function which return the wanted value or directly the value. If you use a function this will be executed at runtime.

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mock: {
          properties: {
            '/tag|name/': 'jon', // Matches every property named 'tag' or 'name', including nested ones
            '/.*.user.id/': faker.string.uuid(), // Matches every property named 'id', inside an object named 'user', including nested ones
            email: () => faker.internet.email(), // Matches only the property 'email'
            'user.id': () => faker.string.uuid(), // Matches only the full path 'user.id'
          },
        },
      },
    },
  },
};
```

##### format

Type: `Object`.

Give you the possibility to put a value for a `format`. In your specification, if you put a `format: email` to a property Orval will automatically generate a random email for you. See the default available format <a href="https://github.com/orval-labs/orval/blob/master/packages/mock/src/faker/constants.ts" target="_blank">here</a>.

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mock: {
          format: {
            email: () => faker.internet.email(),
            iban: () => faker.finance.iban(),
          },
        },
      },
    },
  },
};
```

##### required

Type: `Boolean`.

Give you the possibility to set every property as required.

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mock: {
          required: true,
        },
      },
    },
  },
};
```

##### delay

Type: `number`, `Function` or `false`.

Give you the possibility to set delay time for mock. It can either be a fixed number, false or a function that returns a number.
Setting delay to false removes the delay call completely.

Default Value: `1000`

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mock: {
          delay: 0,
        },
      },
    },
  },
};
```

##### delayFunctionLazyExecute

Type: `boolean`.

Gives you the possibility to have functions that are passed to `delay` to be
executed at runtime rather than when the mocks are generated.

##### generateEachHttpStatus

Type: `Boolean`.

Gives you the possibility to generate mocks for all the HTTP statuses in the `responses` fields in your OpenAPI specification.

##### arrayMin

Type: `Number`.

Set the minimum length of generated arrays for properties that specify multiple items. (Default is `1`)

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mock: {
          arrayMin: 5,
        },
      },
    },
  },
};
```

##### arrayMax

Type: `Number`.

Set the maximum length of generated arrays for properties that specify multiple items. (Default is `10`)

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mock: {
          arrayMax: 15,
        },
      },
    },
  },
};
```

##### useExamples

An extension of the global mock option. If set to `true`, the mock generator will use the `example` property of the specification to generate the mock. If the `example` property is not set, the mock generator will fallback to the default behavior. Will override the global option.

```js
module.exports = {
  petstore: {
    output: {
      override: {
        mock: {
          useExamples: true,
        },
      },
    },
  },
};
```

##### baseUrl

Type: `String`.

Give you the possibility to set base url to your mock handlers. Will override the global option.

#### components

Type: `Object`.

Give you the possibility to override the models

```js
module.exports = {
  petstore: {
    output: {
      override: {
        components: {
          schemas: {
            suffix: 'DTO',
          },
          responses: {
            suffix: 'Response',
          },
          parameters: {
            suffix: 'Params',
          },
          requestBodies: {
            suffix: 'Bodies',
          },
        },
      },
    },
  },
};
```

#### operations

Type: `Object`.

Give you the possibility to override the generated mock by <a href="https://swagger.io/docs/specification/paths-and-operations/" target="_blank">operationId</a>.

Each key of the object should be an operationId and take as value an object.

The value object can take the same properties as the override property (mutator,query,transformer,mock).

The mock options have one more possibility the data property. Which can take a function or the value directly. The function will be executed at runtime.

```js
module.exports = {
  petstore: {
    output: {
      override: {
        operations: {
          listPets: {
            transformer: 'src/yourfunction.js',
            mutator: 'src/response-type.js',
            mock: {
              properties: () => {
                return {
                  id: () => faker.number.int({ min: 1, max: 99999 }),
                };
              },
            },
          },
          showPetById: {
            mock: {
              data: () => ({
                id: faker.number.int({ min: 1, max: 99 }),
                name: faker.person.firstName(),
                tag: faker.helpers.arrayElement([
                  faker.word.sample(),
                  undefined,
                ]),
              }),
            },
          },
        },
      },
    },
  },
};
```

#### tags

Type: `Object`.

Exactly the same as the `override.operations` but this time you can do it by <a href="https://swagger.io/docs/specification/grouping-operations-with-tags/" target="_blank">tags</a>

#### operationName

Type: `Function`.

```ts
// type signature
(operation: OperationObject, route: string, verb: Verbs) => string;
```

Function to override the generate operation name.

#### requestOptions

Type: `Object | Boolean`.

Use this property to provide a config to your http client or completely remove the request options property from the generated files.

#### formData

Type: `Boolean` or `String` or `Object`.

Valid values: path of the formData function or object with a path and name.

Use this property to disable the auto generation of form data if you use multipart

If you provide an object you can also add a default property to use an export default function.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        formData: {
          path: './api/mutator/custom-form-data-fn.ts',
          name: 'customFormDataFn',
          // default: true
        },
      },
    },
  },
};
```

```ts
// type signature
export const customFormDataFn = <Body>(body: Body): FormData => {
  // do your implementation to transform it to FormData

  return FormData;
};
```

#### formUrlEncoded

Type: `Boolean` or `String` or `Object`.

Valid values: path of the formUrlEncoded function or object with a path and name.

Use this property to disable the auto generation of form url encoded

If you provide an object you can also add a default property to use an export default function.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        formUrlEncoded: {
          path: './api/mutator/custom-form-url-encoded-fn.ts',
          name: 'customFormUrlEncodedFn',
          // default: true
        },
      },
    },
  },
};
```

```ts
// type signature
export const customFormUrlEncodedFn = <Body>(body: Body): URLSearchParams => {
  // do your implementation to transform it to FormData

  return URLSearchParams;
};
```

#### paramsSerializer

Type: `String` or `Object`.

Valid values: path of the paramsSerializer function or object with a path and name.

Use this property to add a custom params serializer to all requests that use query params.

If you provide an object you can also add a default property to use an export default function.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        paramsSerializer: {
          path: './api/mutator/custom-params-serializer-fn.ts',
          name: 'customParamsSerializerFn',
          // default: true
        },
      },
    },
  },
};
```

```ts
// type signature
export const customParamsSerializerFn = (
  params: Record<string, any>,
): string => {
  // do your implementation to transform the params

  return params;
};
```

#### paramsSerializerOptions

Type: `Object`

Use this property to add a default params serializer. Current options are: `qs`.

All options are then passed to the chosen serializer.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        paramsSerializerOptions: {
          qs: {
            arrayFormat: 'repeat',
          },
        },
      },
    },
  },
};
```

#### useDates

Type: `Boolean`

Valid values: true or false. Defaults to false.

Use this property to convert OpenAPI `date` or `datetime` to JavaScript `Date` objects instead of `string`.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        useDates: true,
      },
    },
  },
};
```

**Note:** You must provide and Axios converter to convert these to dates as this just makes the TypeScript definition a Date.
You can choose to use any Date library you want like Moment, Luxon, or native JS Dates.

```ts
// type signature
const client = axios.create({
  baseURL: '',
});

client.interceptors.response.use((originalResponse) => {
  handleDates(originalResponse.data);
  return originalResponse;
});

export default client;

const isoDateFormat =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d*)?(?:[-+]\d{2}:?\d{2}|Z)?$/;

function isIsoDateString(value: any): boolean {
  return value && typeof value === 'string' && isoDateFormat.test(value);
}

export function handleDates(body: any) {
  if (body === null || body === undefined || typeof body !== 'object')
    return body;

  for (const key of Object.keys(body)) {
    const value = body[key];
    if (isIsoDateString(value)) {
      body[key] = new Date(value); // default JS conversion
      // body[key] = parseISO(value); // date-fns conversion
      // body[key] = luxon.DateTime.fromISO(value); // Luxon conversion
      // body[key] = moment(value).toDate(); // Moment.js conversion
    } else if (typeof value === 'object') {
      handleDates(value);
    }
  }
}
```

#### useBigInt

Type: `Boolean`

Valid values: true or false. Defaults to false.

Use this property to convert OpenAPI `int64` format to JavaScript `BigInt` objects instead of `number`.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        useBigInt: true,
      },
    },
  },
};
```

#### coerceTypes

Type: `Boolean`

Deprecated: Use `zod.coerce` instead.

Valid values: true or false. Defaults to false.

Use this property to enable [type coercion](https://zod.dev/?id=coercion-for-primitives) for [Zod](https://zod.dev/) schemas (only applies to query parameters schemas).

This is helpful if you want to use the zod schema to coerce (likely string-serialized) query parameters into the correct type before validation.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        coerceTypes: true,
      },
    },
  },
};
```

#### useNamedParameters

Type: `Boolean`.

Default Value: `false`.

Generates the operation interfaces with named path parameters instead of individual arguments for each path parameter.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        useNamedParameters: true,
      },
    },
  },
};
```

#### useTypeOverInterfaces

Type: `Boolean`

Valid values: true or false. Defaults to false.

Use this property to use TypeScript `type` instead of `interface`.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        useTypeOverInterfaces: true,
      },
    },
  },
};
```

#### useDeprecatedOperations

Type: `Boolean`

Valid values: true or false. Defaults to true.

Use this property to include/exclude generating any operation marked `"deprecated": true` in OpenAPI.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        useDeprecatedOperations: false,
      },
    },
  },
};
```

#### contentType

Type: `Object`

Use this property to include or exclude some content types

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        contentType: {
          include: ['application/json'],
          exclude: ['application/xml'],
        },
      },
    },
  },
};
```

#### useNativeEnums

Type: `Boolean`

Valid values: true or false. Defaults to false.

Use this property to generate native Typescript `enum` instead of `type` and `const` combo.

Example:

```js
module.exports = {
  petstore: {
    output: {
      override: {
        useNativeEnums: true,
      },
    },
  },
};
```

#### suppressReadonlyModifier

Type: `Boolean`

Valid Values: `true` or `false`.

Default Value: `false`.

When the `readonly` field is specified in `OpenAPI`, specify `readonly` in the `type` and `interface` fields output from the schema.

```js
module.exports = {
  petstore: {
    output: {
      override: {
        suppressReadonlyModifier: true,
      },
    },
  },
};
```

### allParamsOptional

Type: `Boolean`

Valid Values: `true` or `false`.

Default Value: `false`.

Applies to all clients, but probably only makes sense for `Tanstack Query`.
Use this property to make all parameters optional except the path parameter. This is useful to take advantage of the `Orval`'s auto-enable feature for `Tanstack Query`, see https://github.com/orval-labs/orval/pull/894

```js
module.exports = {
  petstore: {
    output: {
      allParamsOptional: true,
    },
  },
};
```

### urlEncodeParameters

Type: `Boolean`

Valid values: true or false. Defaults to false. **Note:** this only works for Tanstack Query clients for now.

Use this property to enable URL encoding of path/query parameters. This is highly recommended, and will probably become a default in the future, see https://github.com/orval-labs/orval/pull/895

```js
module.exports = {
  petstore: {
    output: {
      urlEncodeParameters: true,
    },
  },
};
```

### optionsParamRequired

Type: `Boolean`

Valid Values: `true` or `false`.

Default Value: `false`.
Use this property to make the second `options` parameter required (such as when using a custom axios instance)

```js
module.exports = {
  petstore: {
    output: {
      optionsParamRequired: true,
    },
  },
};
```
