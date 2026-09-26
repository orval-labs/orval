import type { AxiosRequestConfig } from 'axios';
import axios from 'axios';

export const getWithResponseType = <T>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return axios({ ...config, responseType: 'json' }).then(
    ({ data }) => data as T,
  );
};

export default getWithResponseType;
