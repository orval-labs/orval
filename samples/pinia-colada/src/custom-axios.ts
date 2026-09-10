import axios, { type AxiosRequestConfig } from 'axios';

export const customAxios = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> =>
  axios({ ...config, ...options }).then((response) => response.data);
