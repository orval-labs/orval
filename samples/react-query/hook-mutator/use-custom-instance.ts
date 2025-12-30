import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const useCustomInstance = <T>(): ((
  config: AxiosRequestConfig,
) => Promise<T>) => {
  return (config: AxiosRequestConfig) => {
    const promise = AXIOS_INSTANCE({ ...config }).then(({ data }) => data);

    return promise;
  };
};

export default useCustomInstance;
