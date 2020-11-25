import { AxiosRequestConfig, AxiosResponse } from 'axios';
import { ApiMode } from './constants';
import { getSwaggerPetstore } from './endpoints/petstoreFromFileSpecWithTransformer';
import { getHTTPInstance } from './utilities';

export interface ApiParameters {
  headers?: { [key: string]: string | undefined };
  baseUrl?: string;
  interceptor?: {
    request?: {
      onFulfilled?: (
        value: AxiosRequestConfig,
      ) => AxiosRequestConfig | Promise<AxiosRequestConfig>;
      onRejected?: (error: any) => any;
    };
    response?: {
      onFulfilled?: (
        value: AxiosResponse,
      ) => AxiosResponse | Promise<AxiosResponse>;
      onRejected?: (error: any) => any;
    };
  };
  mode?: ApiMode;
}

export const getApi = ({
  headers = {},
  interceptor,
  baseUrl,
  mode = ApiMode.API,
}: ApiParameters) => {
  const instance = getHTTPInstance(baseUrl, headers, interceptor);

  return getSwaggerPetstore(instance);
};
