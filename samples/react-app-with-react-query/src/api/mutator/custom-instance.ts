import Axios, { AxiosRequestConfig } from 'axios';

const instance = Axios.create({ baseURL: 'test' });

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = instance({ ...config, cancelToken: source.token }).then(
    ({ data }) => data,
  );

  // @ts-ignore
  promise.cancel = () => {
    source.cancel('Query was cancelled by React Query');
  };

  return promise;
};

export default customInstance;
