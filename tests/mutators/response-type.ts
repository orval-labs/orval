import axios, { AxiosRequestConfig } from 'axios';

export const getWithResponseType = <T>(
  config: AxiosRequestConfig,
): Promise<T> => {
  return axios({ ...config, responseType: 'json' }).then(({ data }) => data);
};

export default getWithResponseType;
