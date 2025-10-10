---
id: swr
title: SWR
---

Start by providing an OpenAPI specification and an Orval config file. To use SWR, define the `client` in the Orval config to be `swr`.

## Example with SWR

```js
module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/petstore.ts',
      schemas: 'src/model',
      client: 'swr',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

Navigate to the [Orval config reference](../reference/configuration/full-example) to see all available options.

The SWR client will generate an implementation file with one custom hook per path in the OpenAPI Specification.

For exmaple, <a href="https://github.com/orval-labs/orval/blob/master/samples/react-app-with-swr/petstore.yaml" target="_blank">this Swagger specification</a> will generate the following hooks:

```ts
export const showPetById = (
  petId: string,
  options?: AxiosRequestConfig,
): Promise<AxiosResponse<Pet>> => {
  return axios.get(`/pets/${petId}`, options);
};

export const getShowPetByIdKey = (petId: string) => [`/pets/${petId}`];
Re;

export const useShowPetById = <TError = Error>(
  petId: string,
  options?: {
    swr?: SWRConfiguration<AsyncReturnType<typeof showPetById>, TError> & {
      swrKey?: Key;
      enabled?: boolean;
    };
    axios?: AxiosRequestConfig;
  },
) => {
  const { swr: swrOptions, axios: axiosOptions } = options ?? {};

  const isEnabled = swrOptions?.enabled !== false && !!petId;
  const swrKey =
    swrOptions?.swrKey ?? (() => (isEnabled ? getShowPetByIdKey(petId) : null));
  const swrFn = () => showPetById(petId, axiosOptions);

  const query = useSwr<AsyncReturnType<typeof swrFn>, TError>(
    swrKey,
    swrFn,
    swrOptions,
  );

  return {
    swrKey,
    ...query,
  };
};
```

Go <a href="https://github.com/orval-labs/orval/blob/master/samples/react-app-with-swr" target="_blank">here</a> for a full example
