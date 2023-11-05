## Use your own base url

Orval allows you to set a custom base url for each OpenAPI specification. This can be a part of the url that's been omitted from the specification or the entire url.

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

It's also possible to configure the base url directly on your HTTP client instead.

### Axios

You can set a default baseUrl for all requests:

```ts
axios.defaults.baseURL = '<BACKEND URL>'; // use your own URL here or environment variable
```

You can also use an interceptor to do it:

```ts
axios.interceptors.request.use((config) => {
  return {
    ...config,
    baseURL: '<BACKEND URL>', // use your own URL here or environment variable
  };
});
```

There is also the possibility to create a custom axios instance. Check the [full guide](../guides/custom-axios.md) for more details.

```ts
const AXIOS_INSTANCE = axios.create({ baseURL: '<BACKEND URL>' }); // use your own URL here or environment variable
```

### Angular http client

You can use an interceptor to automatically add the url of your API. Like you would do to add an authorization header.

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

Also remember to add the interceptor to your providers in your module.

```ts
providers: [
  {
    provide: HTTP_INTERCEPTORS,
    useClass: APIInterceptor,
    multi: true,
  },
];
```

### Other client

Depending on the client that you are using, you will need to add it by yourself
