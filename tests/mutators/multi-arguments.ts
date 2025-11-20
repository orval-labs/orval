import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const customInstance = <T>(
  config: AxiosRequestConfig,
  token?: string,
): Promise<T> => {
  const promise = AXIOS_INSTANCE({
    ...config,
    headers: {
      ...config?.headers,
      ...(token ? { Authorization: token } : {}),
    },
  }).then(({ data }) => data);

  return promise;
};

export default customInstance;
