import { useQueryClient } from '@tanstack/react-query';
import type { AxiosRequestConfig } from 'axios';
import Axios from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

// Fixture for the mutator parser: the type parameter is intentionally unused.
// oxlint-disable-next-line typescript/no-unnecessary-type-parameters
export const useCustomInstance = <_T>() => {
  // code test for parser
  const queryClient = useQueryClient();

  queryClient.isFetching();

  return (config: AxiosRequestConfig, headers?: { token: string }) => {
    const promise = AXIOS_INSTANCE({
      ...config,
      headers: headers,
    }).then(({ data }) => {
      // The parser fixture returns Axios' `any` body on purpose.
      // oxlint-disable-next-line typescript/no-unsafe-return
      return data;
    });

    return promise;
  };
};

export default useCustomInstance;
