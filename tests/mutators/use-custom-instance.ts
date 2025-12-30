import { useQueryClient } from '@tanstack/react-query';
import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const useCustomInstance = <T>(): ((
  config: AxiosRequestConfig,
) => Promise<T>) => {
  // code test for parser
  const queryClient = useQueryClient();

  queryClient.isFetching();

  return (config: AxiosRequestConfig) => {
    const promise = AXIOS_INSTANCE({ ...config }).then(({ data }) => data);

    return promise;
  };
};

export default useCustomInstance;
