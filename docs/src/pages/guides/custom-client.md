### Custom client

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

const baseURL = '<BACKEND URL>'; // use your own URL here or environment variable

export const customInstance = async <T>({
  url,
  method,
  params,
  data,
}: {
  url: string;
  method: 'get' | 'post' | 'put' | 'delete' | 'patch';
  params?: any;
  data?: any;
  responseType?: string;
}): Promise<T> => {
  const response = await fetch(
    `${baseURL}${url}` + new URLSearchParams(params),
    {
      method,
      ...(data ? { body: JSON.stringify(data) } : {}),
    },
  );

  return response.json();
};

export default customInstance;
```
