---
id: vue-query
title: Vue Query
---

Start by providing an OpenAPI specification and an Orval config file. To use Vue Query, define the `mode` in the Orval config to be `vue-query`.

## Example with Vue Query

```js
module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/petstore.ts',
      schemas: 'src/model',
      client: 'vue-query',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

Navigate to the [Orval config reference](../reference/configuration/full-example) to see all available options.

The Vue Query mode will generate an implementation file with one custom hook per path in the OpenAPI Specification.

For example, <a href="https://github.com/orval-labs/orval/blob/master/samples/vue-query/petstore.yaml" target="_blank">this Swagger specification</a> will generate the following hooks:

```ts
export const showPetById = (
  petId: string,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<Pet>> => {
  return axios.get(`/pets/${petId}`, options);
};

export const getShowPetByIdQueryKey = (petId: string) => [`/pets/${petId}`];

export const useShowPetById = <
  TData = AsyncReturnType<typeof showPetById>,
  TError = Error,
>(
  petId: string,
  options?: {
    query?: UseQueryOptions<AsyncReturnType<typeof showPetById>, TError, TData>;
    axios?: AxiosRequestConfig;
  },
) => {
  const { query: queryOptions, axios: axiosOptions } = options ?? {};

  const queryKey = queryOptions?.queryKey ?? getShowPetByIdQueryKey(petId);
  const queryFn = () => showPetById(petId, axiosOptions);

  const query = useQuery<AsyncReturnType<typeof queryFn>, TError, TData>(
    queryKey,
    queryFn,
    {
      enabled: !!petId,
      ...queryOptions,
    },
  );

  return {
    queryKey,
    ...query,
  };
};
```

## How to Use Other Queries

Given the following configuration, Orval will generate useQuery and useInfiniteQuery hooks with a `nextId` query parameter. It is also possible to override the config for every hook with the `options` field.

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

If needed, it is also possible to override the `query` options for a single operation or tag:

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

Go <a href="https://github.com/orval-labs/orval/tree/master/samples/vue-query" target="_blank">here</a> for a full example
