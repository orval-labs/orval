import Axios, { AxiosError, AxiosRequestConfig } from 'axios';

export const AXIOS_INSTANCE = Axios.create();

export default function customInstance<T>(
  config: AxiosRequestConfig,
): Promise<T> {
  return AXIOS_INSTANCE({ ...config }).then(({ data }) => data);
}

export type ErrorType<Error> = AxiosError<Error>;
