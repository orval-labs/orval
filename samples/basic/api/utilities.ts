import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export const createApiError = <T extends any>(error?: T): T => {
  return ({
    code: 'INTERNALSERVERERROR',
    message: '',
    ...error,
  } as any) as T;
};

export const getHTTPInstance = (
  baseUrl: string | undefined,
  headers?: { [key: string]: string | undefined },
  interceptor?: {
    request?: {
      onFulfilled?: (
        value: AxiosRequestConfig,
      ) => AxiosRequestConfig | Promise<AxiosRequestConfig>;
      onRejected?: (error: any) => any;
    };
    response?: {
      onFulfilled?: (
        value: AxiosResponse,
      ) => AxiosResponse | Promise<AxiosResponse>;
      onRejected?: (error: any) => any;
    };
  },
): AxiosInstance => {
  const instance = axios.create({
    baseURL: baseUrl,
    headers,
  });

  if (interceptor?.request) {
    instance.interceptors.request.use(
      interceptor.request.onFulfilled,
      interceptor.request.onRejected,
    );
  }

  if (interceptor?.response) {
    instance.interceptors.response.use(
      interceptor.response.onFulfilled,
      interceptor.response.onRejected,
    );
  }

  return instance;
};

export type HttpResponse<V, E extends any> = [E | null, V | undefined];
/**
 * Handling Promise error for axios
 * @param promise
 */
export function httpTo<V, E extends any>(
  promise: Promise<V>,
): Promise<HttpResponse<V, E>> {
  return promise
    .then<[null, V]>((data) => [null, data])
    .catch<[E, undefined]>((error: E) => {
      return [createApiError(error), undefined];
    });
}
