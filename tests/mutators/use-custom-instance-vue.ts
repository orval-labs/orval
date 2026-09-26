import { useQueryClient } from '@tanstack/vue-query';
import type { AxiosRequestConfig } from 'axios';
import Axios from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const useCustomInstance = <T>(): ((
  config: AxiosRequestConfig,
) => Promise<T>) => {
  const queryClient = useQueryClient();

  queryClient.isFetching();

  return (config: AxiosRequestConfig) => {
    const promise = AXIOS_INSTANCE({ ...config }).then(({ data }) => data as T);

    return promise;
  };
};

export default useCustomInstance;
