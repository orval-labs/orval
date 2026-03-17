import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

const normalizeHeaders = (
  headers?: HeadersInit,
): AxiosRequestConfig['headers'] => {
  if (!headers) {
    return undefined;
  }

  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries());
  }

  if (Array.isArray(headers)) {
    return Object.fromEntries(headers);
  }

  return headers;
};

export const customInstance = <T>(
  configOrUrl: AxiosRequestConfig | string,
  config?: RequestInit,
): Promise<T> => {
  const resolvedConfig: AxiosRequestConfig =
    typeof configOrUrl === 'string'
      ? {
          url: configOrUrl,
          method: config?.method,
          data: config?.body,
          headers: normalizeHeaders(config?.headers),
          signal: config?.signal ?? undefined,
        }
      : { ...configOrUrl };

  const promise = AXIOS_INSTANCE(resolvedConfig).then(({ data }) => data);

  return promise;
};

export default customInstance;
