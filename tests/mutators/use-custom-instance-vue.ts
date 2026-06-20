import { useQueryClient } from '@tanstack/vue-query';
import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const useCustomInstance = <T>(): ((
  config: AxiosRequestConfig,
) => Promise<T>) => {
  const queryClient = useQueryClient();

  queryClient.isFetching();

  return (config: AxiosRequestConfig) => {
    const promise = AXIOS_INSTANCE({ ...config }).then(({ data }) => data);

    return promise;
  };
};

export default useCustomInstance;
