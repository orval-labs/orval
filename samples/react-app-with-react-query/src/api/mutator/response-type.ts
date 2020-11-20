import Axios, { AxiosRequestConfig } from 'axios';

const instance = Axios.create({ baseURL: 'test' });

export const responseType = <T>(config: AxiosRequestConfig,): Promise<T> =>
  instance(config).then(({ data }) => data);

export default responseType;
