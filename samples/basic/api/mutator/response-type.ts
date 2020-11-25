import { AxiosInstance, AxiosRequestConfig } from 'axios';

export const getWithResponseType = <T>(
  config: AxiosRequestConfig,
  axios: AxiosInstance,
): Promise<T> => {
  return axios({ ...config, responseType: 'json' }).then(({ data }) => data);
};

export default getWithResponseType;
