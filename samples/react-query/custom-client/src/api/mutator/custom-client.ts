import Axios from 'axios';
import { useAuth } from '../../auth.context';

export const AXIOS_INSTANCE = Axios.create({ baseURL: '' });

type CustomClient<T> = (data: {
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, any>;
  headers?: Record<string, any>;
  data?: BodyType<unknown>;
  signal?: AbortSignal;
}) => Promise<T>;

export const useCustomClient = <T>(): CustomClient<T> => {
  const token = useAuth();

  return async ({ url, method, params, data }) => {
    const response = await fetch(url + new URLSearchParams(params), {
      method,
      headers: { ...data?.headers, Authorization: `Bearer ${token}` },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });

    return response.json();
  };
};

export default useCustomClient;

export type ErrorType<ErrorData> = ErrorData;

export type BodyType<BodyData> = BodyData & { headers?: any };
