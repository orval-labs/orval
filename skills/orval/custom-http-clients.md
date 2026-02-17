# Custom HTTP Client (Mutator)

Replace the default HTTP implementation with a custom mutator.

## Basic Axios Mutator

```ts
// orval.config.ts
output: {
  override: {
    mutator: {
      path: './api/mutator/custom-instance.ts',
      name: 'customInstance',
    },
  },
}
```

```ts
// custom-instance.ts
import Axios, { AxiosRequestConfig, AxiosError } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  return AXIOS_INSTANCE({ ...config }).then(({ data }) => data);
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
```

## Axios with Interceptors (Auth, Error Handling)

```ts
// custom-instance.ts
import Axios, { AxiosRequestConfig, AxiosError } from 'axios';

export const AXIOS_INSTANCE = Axios.create({
  baseURL: process.env.API_URL,
});

// Request interceptor — token injection
AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// Response interceptor — error handling
AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized
    }
    return Promise.reject(error);
  },
);

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  return AXIOS_INSTANCE({ ...config }).then(({ data }) => data);
};

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
```

## React Context Auth with Interceptors

```tsx
// auth.context.tsx
import { useEffect, useState, createContext, useContext } from 'react';
import { AXIOS_INSTANCE } from './api/mutator/custom-instance';

const AuthProvider = ({ children, initialState = null }) => {
  const [token, setToken] = useState(initialState);

  useEffect(() => {
    const interceptorId = AXIOS_INSTANCE.interceptors.request.use((config) => {
      if (config.headers && token) {
        config.headers.set('Authorization', `Bearer ${token}`);
      }
      return config;
    });

    return () => {
      AXIOS_INSTANCE.interceptors.request.eject(interceptorId);
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

## Hook-Based Mutator (Axios)

Allows using React hooks inside the mutator (e.g., for auth state, callbacks):

```ts
// orval.config.ts
output: {
  override: {
    mutator: {
      path: './use-custom-instance.ts',
      name: 'useCustomInstance',
    },
  },
}
```

```ts
// use-custom-instance.ts
import Axios, { type AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const useCustomInstance = <T>(): ((
  config: AxiosRequestConfig,
) => Promise<T>) => {
  // Can use React hooks here (useAuth, useCallback, etc.)
  return (config: AxiosRequestConfig) => {
    return AXIOS_INSTANCE({ ...config }).then(({ data }) => data);
  };
};

export default useCustomInstance;
```

## Hook-Based Mutator (Fetch with useCallback)

```ts
// use-custom-fetch.ts
import { useCallback, useState } from 'react';

export function useGetBaseUrl() {
  const [baseUrl] = useState('');
  return baseUrl;
}

export function useCustomFetch() {
  const baseUrl = useGetBaseUrl();
  return useCallback(
    async <T>(url: string, options?: RequestInit): Promise<T> => {
      const headers = new Headers(options?.headers);
      const response = await fetch(`${baseUrl}${url}`, {
        ...options,
        headers,
      });
      if (!response.ok) throw new Error('Network response was not ok');
      return response.json();
    },
    [],
  );
}
```

## Fetch with Content-Type Detection

Handle PDF, blob, text, XML responses (not just JSON):

```ts
// custom-fetch.ts
const getBody = <T>(c: Response | Request): Promise<T> => {
  const contentType = c.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return c.json();
  }
  if (contentType && contentType.includes('application/pdf')) {
    return c.blob() as Promise<T>;
  }
  return c.text() as Promise<T>;
};

const getUrl = (contextUrl: string): string => {
  const url = new URL(contextUrl);
  const baseUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://api.production.com'
      : 'http://localhost:3000';
  return new URL(`${baseUrl}${url.pathname}${url.search}`).toString();
};

export const customFetch = async <T>(
  url: string,
  options: RequestInit,
): Promise<T> => {
  const requestUrl = getUrl(url);
  const requestHeaders = {
    ...options.headers,
    Authorization: 'Bearer my-token',
  };
  const response = await fetch(requestUrl, {
    ...options,
    headers: requestHeaders,
  });
  const data = await getBody<T>(response);
  return { status: response.status, data, headers: response.headers } as T;
};

export default customFetch;
```

## Fetch Client Config

Native Fetch API — no dependencies, works in browsers, Node.js, Cloudflare Workers, Vercel Edge, Deno.

```ts
output: {
  client: 'fetch',
  baseUrl: 'http://localhost:3000',
  override: {
    fetch: {
      includeHttpResponseReturnType: false,  // Return data directly instead of { data, status }
      forceSuccessResponse: true,            // Throw on error responses
      runtimeValidation: true,               // Validate responses with Zod
      jsonReviver: {                         // Custom JSON reviver (e.g. for dates)
        path: './reviver.ts',
        name: 'dateReviver',
      },
    },
  },
}
```

## Environment-Based URL Switching

Using base URL from spec with variables:

```ts
output: {
  baseUrl: {
    getBaseUrlFromSpecification: true,
    variables: {
      environment: process.env.NODE_ENV === 'production' ? 'api.prod' : 'api.dev',
    },
  },
}
```

Or use a `getUrl` function in a custom fetch mutator (see the `getUrl` pattern in "Fetch with Content-Type Detection" above).
