import { AxiosError } from 'axios';
import { useMemo } from 'react';
import { getApi } from './config';
import { getAuthHeader } from './headers';
import { createApiError } from './utilities';

export const useApi = () => {
  const token = 'xxxxxxxx'; // get your token

  const headers = useMemo(
    () => ({
      ...getAuthHeader(token),
    }),
    [token],
  );

  const unauthorizedAndErrorInterceptor = useMemo(
    () => ({
      response: {
        onRejected(error: AxiosError): Promise<unknown> | void {
          //do your check
          return Promise.reject(createApiError());
        },
      },
    }),
    [],
  );

  return useMemo(
    () =>
      getApi({
        headers,
        interceptor: unauthorizedAndErrorInterceptor,
        baseUrl: '', // use an env or your api url
      }),
    [headers, unauthorizedAndErrorInterceptor],
  );
};
