### Custom instance

You can add a mutator function to your config and setup a custom instance of axios.

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

export const AXIOS_INSTANCE = Axios.create({ baseURL: '<BACKEND URL>' }); // use your own URL here or environment variable

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({ ...config, cancelToken: source.token }).then(
    ({ data }) => data,
  );

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled');
  };

  return promise;
};
```
