---
id: trpc
title: tRPC
---

You should have an OpenApi specification and an Orval config where you define the mode as trpc.

#### Example with tRPC

```js
module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/petstore.ts',
      schemas: 'src/model',
      client: 'trpc',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

Checkout the [orval config](../reference/configuration/full-example) reference to see all available options.

The tRPC model will generate an implementation file with one custom hook per path in your OpenApi Specification.

Like the following example from this <a href="https://github.com/anymaniax/orval/blob/master/samples/trpc/basic/petstore.yaml" target="_blank">swagger</a>:

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
    { enabled: !!petId, ...queryOptions },
  );

  return {
    queryKey,
    ...query,
  };
};
```

Checkout <a href="https://github.com/anymaniax/orval/blob/master/samples/trpc/basic" target="_blank">here</a> the full example
