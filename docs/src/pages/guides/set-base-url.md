## Use your own base url

orval doesn't set any base url by default but you have multiple possibility to add it

### Axios

You can set a default baseUrl

```ts
Axios.defaults.baseURL = '<BACKEND URL>'; // use your own URL here or environment variable
```

You can also use an interceptor to do it

```ts
axios.interceptors.request.use((config) => {
  return {
    ...config,
    baseURL: '<BACKEND URL>', // use your own URL here or environment variable
  };
});
```

There is also the possibilty to create a custom axios instance

```ts
const AXIOS_INSTANCE = Axios.create({ baseURL: '<BACKEND URL>' }); // use your own URL here or environment variable
```

### Angular http client

You can use an interceptor to automatically add the url of your API. Like you would do to add an authorization header.

### Other client

Depending the client that you are using you will need to add it by yourself
