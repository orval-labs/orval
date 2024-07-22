---
id: svelte-query
title: Svelte query
---

You should have an OpenAPI specification and an Orval config where you define the mode as svelte-query.

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

The svelte query model will generate an implementation file with one custom hook per path in your OpenAPI Specification.

Like the following example from this <a href="https://github.com/orval-labs/orval/blob/master/samples/svelte-query/petstore.yaml" target="_blank">swagger</a>:

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

### How use other query

With the following example Orval will generate a useQuery and useInfinteQuery with a nextId queryparam. You can also override the config for each one with the options props.

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

Checkout <a href="https://github.com/orval-labs/orval/tree/master/samples/svelte-query" target="_blank">here</a> the full example
