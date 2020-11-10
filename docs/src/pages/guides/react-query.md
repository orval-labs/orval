---
id: react-query
title: React query
---

You should have an OpenApi specification and an orval config where you define the mode as react-query.

#### Example with react query

```js
module.exports = {
  petstore: {
    output: {
      mode: 'tags-split',
      target: 'src/api/endpoints/petstoreFromFileSpec.ts',
      schemas: 'src/api/model',
      client: 'react-query',
      mock: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
};
```

Checkout the [orval config](../reference/orval-config) reference to see all available options.

The react query model wil generate an implementation file with one custom hook per path in your OpenApi Specification.

Like the following example from this <a href="https://github.com/anymaniax/orval/blob/master/samples/react-app-with-react-query/petstore.yaml" target="_blank">swagger</a>:

```ts
const useListPets = (
  params?: ListPetsParams,
  version: number = 1,
  queryConfig?: QueryConfig<AxiosResponse<Pets>, AxiosError>,
) => {
  return useQuery<AxiosResponse<Pets>, AxiosError>(
    [
      `/v${version}/pets`,
      {
        params,
      },
    ],
    (path: string, options: Partial<AxiosRequestConfig>) =>
      axios.get<Pets>(path, options),
    { enabled: version, ...queryConfig },
  );
};
```

### How to set a backend url

You should add an interceptor to axios to set automatically your url like this

```js
axios.interceptors.request.use((config) => {
  return {
    ...config,
    baseURL: '<BACKEND URL>',
  };
});
```

### How to add headers

Like for the backend url you should use an interceptor to set your header automatically.

You can use a context to add automatically an authorization for example.

```ts
const AuthProvider = ({ children, initialState = null }: AuthProviderProps) => {
  // it's a quick demo with useState but you can also have a more complexe state with a useReducer
  const [token, setToken] = useState(initialState);

  useEffect(() => {
    const interceptorId = axios.interceptors.request.use((config) => {
      return {
        ...config,
        headers: token
          ? {
              ...config.headers,
              Authorization: `Bearer ${token}`,
            }
          : config.headers,
      };
    });

    return () => {
      axios.interceptors.request.eject(interceptorId);
    };
  }, [token]);

  return (
    <AuthContext.Provider value={token}>
      <AuthDispatchContext.Provider value={setToken}>
        {children}
      </AuthDispatchContext.Provider>
    </AuthContext.Provider>
  );
};
```

Checkout <a href="https://github.com/anymaniax/orval/blob/master/samples/react-app-with-react-query/src/auth.context.tsx" target="_blank">here</a> the full example
