import type { AxiosRequestConfig } from 'axios';
import Axios from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const customInstance = <T>(
  config: AxiosRequestConfig,
  token?: string,
): Promise<T> => {
  const promise = AXIOS_INSTANCE({
    ...config,
    headers: {
      ...(config?.headers as Record<string, unknown> | undefined),
      ...(token ? { Authorization: token } : {}),
    },
  }).then(({ data }) => data);

  return promise;
};

export default customInstance;
