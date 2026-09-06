import type { AxiosError, AxiosRequestConfig } from 'axios';
import Axios from 'axios';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

export const customInstance = <T>(config: AxiosRequestConfig): Promise<T> => {
  console.log('🌐 Making axios request:', config);

  const promise = AXIOS_INSTANCE({ ...config })
    .then(({ data }) => {
      console.log('✅ Axios response received:', data);
      return data;
    })
    .catch((error) => {
      console.error('❌ Axios request failed:', error);
      throw error;
    });

  return promise;
};

export default customInstance;

export interface ErrorType<Error> extends AxiosError<Error> {}
