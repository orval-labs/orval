import type { AxiosRequestConfig } from 'axios';
import Axios from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  return AXIOS_INSTANCE(config).then(({ data }) => data);
};

export default customInstance;
