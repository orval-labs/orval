---
id: svelte-query
title: Svelte query
---

You should have an OpenApi specification and an orval config where you define the mode as svelte-query.

#### Example with svelte query

```js
module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/petstore.ts',
      schemas: 'src/model',
      client: 'svelte-query',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

Checkout the [orval config](../reference/configuration/full-example) reference to see all available options.

The svelte query model will generate an implementation file with one custom hook per path in your OpenApi Specification.

Like the following example from this <a href="https://github.com/anymaniax/orval/blob/master/samples/svelte-query/petstore.yaml" target="_blank">swagger</a>:

```ts
export const showPetById = <Data = unknown>(
  petId: string,
  version = 1,
  options?: SecondParameter<typeof customInstance>,
) => {
  return customInstance<Data extends unknown ? Pet : Data>(
    { url: `/v${version}/pets/${petId}`, method: 'get' },
    // eslint-disable-next-line
    // @ts-ignore
    options,
  );
};

export const getShowPetByIdQueryKey = (petId: string, version = 1) => [
  `/v${version}/pets/${petId}`,
];

export const useShowPetById = <
  Data extends unknown = unknown,
  Error extends unknown = unknown
>(
  petId: string,
  version = 1,
  options?: {
    query?: UseQueryOptions<AsyncReturnType<typeof showPetById>, Error>;
    request?: SecondParameter<typeof customInstance>;
  },
) => {
  const queryKey = getShowPetByIdQueryKey(petId, version);
  const { query: queryOptions, request: requestOptions } = options || {};

  const query = useQuery<AsyncReturnType<typeof showPetById>, Error>(
    queryKey,
    () => showPetById<Data>(petId, version, requestOptions),
    { enabled: !!(version && petId), ...queryOptions },
  );

  return {
    queryKey,
    ...query,
  };
};
```

### How use other query

With the following example orval will generate a useQuery and useInfinteQuery with a nextId queryparam. You can also override the config for each one with the options props.

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
        },
      },
    },
    ...
  },
};
```

If needed you can also override directly to an operation or a tag

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        operations: {
          listPets: {
            query: {
              ...
            },
          }
        },
      },
    }
    ...
  },
};
```

### How to set a backend url

#### Mutator

You can add a mutator function to your config and setup a custom instance of your prefered HTTP client.

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        mutator: {
          path: './api/mutator/custom-instance.ts',
          name: 'customInstance',
        },
      },
    }
    ...
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
    source.cancel('Query was cancelled by Svelte Query');
  };

  return promise;
};
```

#### Alternative

You can add an interceptor to set automatically your url

```js
axios.interceptors.request.use((config) => {
  return {
    ...config,
    baseURL: '<BACKEND URL>',
  };
});
```
