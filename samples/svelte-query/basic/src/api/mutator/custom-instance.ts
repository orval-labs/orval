import type { AxiosRequestConfig } from 'axios';

const buildUrl = (
  url: string,
  params: AxiosRequestConfig['params'],
): string => {
  if (!params || typeof params !== 'object') {
    return url;
  }

  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        searchParams.append(key, String(item));
      }
      continue;
    }

    searchParams.append(key, String(value));
  }

  const query = searchParams.toString();

  return query ? `${url}?${query}` : url;
};

const getBody = async <T>(response: Response): Promise<T> => {
  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type');

  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return response.text() as Promise<T>;
};

export const customInstance = async <T>(
  config: AxiosRequestConfig,
): Promise<T> => {
  const response = await fetch(buildUrl(config.url ?? '', config.params), {
    method: config.method,
    headers: config.headers as HeadersInit,
    body: config.data === undefined ? undefined : JSON.stringify(config.data),
    signal: config.signal as AbortSignal | undefined,
  });

  if (!response.ok) {
    throw await getBody(response);
  }

  return getBody<T>(response);
};

export default customInstance;
