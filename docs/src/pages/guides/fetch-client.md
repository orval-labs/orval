---
id: fetch-client
title: Fetch Client
---

To use the Fetch API as an HTTP client with swr or TanStack Query clients, change the `httpClient` option from `axios` to `fetch`.

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
  data: Pets | BadRequest;
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
  const data: Pets =
    [204, 205, 304].includes(res.status) || !res.body ? {} : await res.json();

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

## Returning the Originally Defined Return Type

When using `fetch` as the `httpClient`, by default the `fetch` response type includes HTTP status.
When using `swr` or queries, you will be accessing the returned data through `data.data`, which may become tedious. To return a defined return type instead of an automatically generated return type, set `override.fetch.includeHttpResponseReturnType` value to `false`.

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
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
-   data: Pets | BadRequest;
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
  const data: Pets =
    [204, 205, 304].includes(res.status) || !res.body ? {} : await res.json();

-  return { status: res.status, data };
+  return data;
};
```

## Custom Fetch Client

To use a custom Fetch client, provide a `mutator` in the `override` option.

```js
module.exports = {
  petstore: {
    output: {
      ...
      client: 'swr',
      httpClient: 'fetch',
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
