---
id: fetch
title: Fetch
---

The `fetch` API has the advantage of reducing the bundle size of the application compared to using `Axios`. It can also act as an `http client` in server-side frameworks and edge computing runtimes such as `Cloudflare`, `Vercel Edge` and `Deno`.

You should have an `OpenAPI` specification and an `Orval` config where you define the mode as `fetch`.

#### Example with fetch

```ts
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'app/gen/petstore.ts',
      schemas: 'app/gen/models',
      client: 'fetch',
      baseUrl: 'http://localhost:3000',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
```

Checkout the [orval config](../reference/configuration/full-example) reference to see all available options.
Like the following example from this <a href="https://github.com/orval-labs/orval/blob/master/samples/next-app-with-fetch/petstore.yaml" target="_blank">`OpenAPI` Specification</a>:

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

  return `http://localhost:3000/pets?${normalizedParams.toString()}`;
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
```

The `fetch` client will generate an implementation file with following per path in your `OpenAPI` Specification.

1. A response type for the `fetch` function
2. A Function to generate request URL including query parameters and path parameters
3. A function that call `fetch` API.

Checkout <a href="https://github.com/orval-labs/orval/blob/master/samples/next-app-with-fetch" target="_blank">here</a> the full example

#### Custom function

You can add a custom `fetch` function to your config.

```ts
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        mutator: {
          path: './custom-fetch.ts',
          name: 'customFetch',
        },
      },
    }
    ...
  },
};
```

And, you prepare like the <a href="https://github.com/orval-labs/orval/blob/master/samples/next-app-with-fetch/custom-fetch.ts" target="_blank">sample implementation</a>
Then, you can generate a `fetch` client that calls the `customFetch` function like bellow:

```ts
export const listPets = async (
  params?: ListPetsParams,
  options?: RequestInit,
): Promise<listPetsResponse> => {
  return customFetch<Promise<listPetsResponse>>(getListPetsUrl(params), {
    ...options,
    method: 'GET',
  });
};
```
