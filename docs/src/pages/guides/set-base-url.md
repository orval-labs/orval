---
id: set-base-url
title: Custom Base URL
---

Orval allows you to set a custom base url for each OpenAPI specification. This can be a part of the url that's been omitted from the specification or the entire url. You can also configure Orval to read the `servers` field in the specification.

```ts
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
      baseUrl: '/api/v2',
      // baseUrl: 'https://petstore.swagger.io/v2',
    },
  },
};
```

## Base URL from the OpenAPI Specification

To use the URL defined in the OpenAPI specification, described by the `servers` field, set `getBaseUrlFromSpecification`
to `true`, which will make Orval correctly identify which base URL to use for each operation. Read more about configuration settings in the [output configuration reference](../reference/configuration/output#baseurl).

```ts
module.exports = {
  petstore: {
    output: {
      target: 'src/petstore.ts',
      baseUrl: {
        getBaseUrlFromSpecification: true,
        variables: {
          environment: 'api.dev',
        },
      },
    },
  },
};
```

It's also possible to configure the base URL directly on the HTTP client instead.

## Axios

Axios allows setting a default `baseUrl` for all requests:

```ts
axios.defaults.baseURL = '<BACKEND URL>'; // use your own URL here or environment variable
```

Or using an interceptor:

```ts
axios.interceptors.request.use((config) => {
  return {
    ...config,
    baseURL: '<BACKEND URL>', // use your own URL here or environment variable
  };
});
```

It is also possible to create a custom Axios instance. Check the [full guide](../guides/custom-axios) for more details.

```ts
const AXIOS_INSTANCE = axios.create({ baseURL: '<BACKEND URL>' }); // use your own URL here or environment variable
```

## Fetch Client

It is possible to set a base URL by providing a custom Fetch client.

```ts
const getUrl = (contextUrl: string): string => {
  const url = new URL(contextUrl);
  const pathname = url.pathname;
  const search = url.search;
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? 'productionBaseUrl'
      : 'http://localhost:3000';

  const requestUrl = new URL(`${baseUrl}${pathname}${search}`);

  return requestUrl.toString();
};

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const requestUrl = getUrl(url);
  const requestInit: RequestInit = {
    ...options,
  };

  const request = new Request(requestUrl, requestInit);
  const response = await fetch(request);
  const data = await getBody<T>(response);

  return { status: response.status, data } as T;
};
```

Please refer to the complete sample [here](https://github.com/orval-labs/orval/blob/master/samples/next-app-with-fetch/custom-fetch.ts)

## Angular HTTP Client

Angular allows setting an interceptor to automatically add the URL of the API.

```ts
import { Injectable } from '@angular/core';
import {
  HttpEvent,
  HttpInterceptor,
  HttpHandler,
  HttpRequest,
} from '@angular/common/http';
import { Observable } from 'rxjs/Observable';

@Injectable()
export class APIInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    const apiReq = req.clone({ url: `<BACKEND URL>/${req.url}` });
    return next.handle(apiReq);
  }
}
```

Remember to add the interceptor to your providers in your module.

```ts
providers: [
  {
    provide: HTTP_INTERCEPTORS,
    useClass: APIInterceptor,
    multi: true,
  },
];
```
