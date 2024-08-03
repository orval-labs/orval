### Fetch client

If you want to use to the `fetch` API as an http client with `swr` or `TanStack Query` clients, you can change the http client from `axios` to `fetch` API by setting the `httpClient` option.

```js
module.exports = {
  petstore: {
    output: {
      ...
      client: 'swr',
      httpClient: 'fetch'
      ...
    },
  },
};
```

```ts
/**
 * @summary List all pets
 */
export type listPetsResponse = {
  data: Pets;
  status: number;
};

export const getListPetsUrl = (params?: ListPetsParams) => {
  const normalizedParams = new URLSearchParams();

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value === null) {
      normalizedParams.append(key, 'null');
    } else if (value !== undefined) {
      normalizedParams.append(key, value.toString());
    }
  });

  return normalizedParams.size
    ? `http://localhost:8000/pets?${normalizedParams.toString()}`
    : `http://localhost:8000/pets`;
};

export const listPets = async (
  params?: ListPetsParams,
  options?: RequestInit,
): Promise<listPetsResponse> => {
  const res = await fetch(getListPetsUrl(params), {
    ...options,
    method: 'GET',
  });
  const data = await res.json();

  return { status: res.status, data };
};

export const getListPetsKey = (params?: ListPetsParams) =>
  [`http://localhost:8000/pets`, ...(params ? [params] : [])] as const;

export type ListPetsQueryResult = NonNullable<
  Awaited<ReturnType<typeof listPets>>
>;
export type ListPetsQueryError = Promise<Pets | Error>;

/**
 * @summary List all pets
 */
export const useListPets = <TError = Promise<Pets | Error>>(
  params?: ListPetsParams,
  options?: {
    swr?: SWRConfiguration<Awaited<ReturnType<typeof listPets>>, TError> & {
      swrKey?: Key;
      enabled?: boolean;
    };
    fetch?: RequestInit;
  },
) => {
  const { swr: swrOptions, fetch: fetchOptions } = options ?? {};

  const isEnabled = swrOptions?.enabled !== false;
  const swrKey =
    swrOptions?.swrKey ?? (() => (isEnabled ? getListPetsKey(params) : null));
  const swrFn = () => listPets(params, fetchOptions);

  const query = useSwr<Awaited<ReturnType<typeof swrFn>>, TError>(
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

#### return original defined return type

When using `fetch` as an `httpClient`, by default the `fetch` response type includes http status.
If use `swr` or queries, i will be accessing things like `data.data`, which will be noisy so if you want to return a defined return type instead of an automatically generated return type, set `override.fetch.includeHttpStatusReturnType` value to `false`.

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

```diff
/**
 * @summary List all pets
 */
- export type listPetsResponse = {
-   data: Pets;
-   status: number;
- };

export const listPets = async (
  params?: ListPetsParams,
  options?: RequestInit,
- ): Promise<listPetsResponse> => {
+ ): Promise<Pet> => {
  const res = await fetch(getListPetsUrl(params), {
    ...options,
    method: 'GET',
  });
  const data = await res.json();

-  return { status: res.status, data };
+  return data as Pet;
};
```

#### custom fetch client

Also, if you want to use to the custom fetch client, you can set in the override option.

```js
module.exports = {
  petstore: {
    output: {
      ...
      client: 'swr',
      httpClient: 'fetch'
      override: {
        mutator: {
          path: './src/mutator.ts',
          name: 'customFetch',
        },
      },
    },
  },
};
```
