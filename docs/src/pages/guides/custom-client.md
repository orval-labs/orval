### Custom client

You can add a mutator function to your config and setup a custom instance of your preferred HTTP client.

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
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: any;
  data?: BodyType<unknown>;
  responseType?: string;
}): Promise<T> => {
  let targetUrl = `${baseURL}${url}`;

  if (params) {
    targetUrl += '?' + new URLSearchParams(params);
  }

  const response = await fetch(targetUrl, {
    method,
    ...(data ? { body: JSON.stringify(data) } : {}),
  });

  return response.json();
};

export default customInstance;

// In some case with react-query and swr you want to be able to override the return error type so you can also do it here like this
export type ErrorType<Error> = AxiosError<Error>;
// In case you want to wrap the body type (optional)
// (if the custom instance is processing data before sending it, like changing the case for example)
export type BodyType<BodyData> = CamelCase<BodyType>;
```

Or, Please refer to the using custom fetch with Next.js sample app [here](https://github.com/orval-labs/orval/blob/master/samples/next-app-with-fetch/custom-fetch.ts).

#### Angular

Even if you use the `angular` client, you can add mutator functions to your configuration to set up your preferred HTTP client.

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        mutator: 'src/api/mutator/response-type.ts'
      }
    }
    ...
  },
};
```

```ts
// response-type.ts

import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const responseType = <Result>(
  {
    url,
    method,
    params,
    data,
  }: {
    url: string;
    method: string;
    params?: any;
    data?: any;
    headers?: any;
  },
  http: HttpClient,
): Observable<Result> =>
  http.request<Result>(method, url, {
    params,
    body: data,
    responseType: 'json',
  });

export default responseType;
```

Please also refer to sample app for more details.

https://github.com/orval-labs/orval/tree/master/samples/angular-app
