import { useQueryClient } from '@tanstack/react-query';
import Axios, { AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const useCustomInstance = <T>() => {
  // code test for parser
  const queryClient = useQueryClient();

  queryClient.isFetching();

  return (config: AxiosRequestConfig, headers?: { token: string }) => {
    const source = Axios.CancelToken.source();
    const promise = AXIOS_INSTANCE({
      ...config,
      cancelToken: source.token,
      headers: headers,
    }).then(({ data }) => data);

    // @ts-ignore
    promise.cancel = () => {
      source.cancel('Query was cancelled by React Query');
    };

    return promise;
  };
};

export default useCustomInstance;
