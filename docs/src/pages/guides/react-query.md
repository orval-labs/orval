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
      target: 'src/petstore.ts',
      schemas: 'src/model',
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

The react query model will generate an implementation file with one custom hook per path in your OpenApi Specification.

Like the following example from this <a href="https://github.com/anymaniax/orval/blob/master/samples/react-app-with-react-query/petstore.yaml" target="_blank">swagger</a>:

```ts
export const showPetById = (petId: string, version: number = 1) => {
  return axios.get<Pet>(`/v${version}/pets/${petId}`);
};

export const getShowPetByIdQueryKey = (petId: string, version: number = 1) => [
  `/v${version}/pets/${petId}`,
];

export const useShowPetById = <Error = unknown>(
  petId: string,
  version: number = 1,
  queryConfig?: UseQueryOptions<AsyncReturnType<typeof showPetById>, Error>,
) => {
  const queryKey = getShowPetByIdQueryKey(petId, version);

  const query = useQuery<AsyncReturnType<typeof showPetById>, Error>(
    queryKey,
    () => showPetById(petId, version),
    { enabled: !!(version && petId), ...queryConfig },
  );

  return {
    queryKey,
    ...query,
  };
};
```

### How use other query

With the following example orval will generate a useQuery and useInfinteQuery with a nextId queryparam. You can also override the config for each one with the config props.

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        query: {
          useQuery: true,
          useInfinite: true,
          useInfiniteQueryParam: 'nextId',
          config: {
            staleTime: 10000,
          },
        },
      },
    },
    ...
  },
};
```

If needed you can also override directly to an operation or a tag

```js
module.exports = {
  petstore: {
    output: {
      ...
      override: {
        operations: {
          listPets: {
            query: {
              ...
            },
          }
        },
      },
    }
    ...
  },
};
```

### How to set a backend url

#### Mutator

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

import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({ ...config, cancelToken: source.token }).then(
    ({ data }) => data,
  );

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled by React Query');
  };

  return promise;
};
```

#### Alternative

You can add an interceptor to set automatically your url

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
