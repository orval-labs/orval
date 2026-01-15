import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';

export interface ExtendedServerErrorResponse<Error> extends HttpErrorResponse {
  error: Error | any | null;
}

export type ErrorType<Error> = ExtendedServerErrorResponse<Error>;

export const customAngularInstance = <Result>({
  url,
  method,
  params,
  data,
  signal,
  responseType,
}: {
  url: string;
  method: string;
  params?: any;
  data?: any;
  headers?: any;
  signal?: AbortSignal;
  responseType?: 'arraybuffer' | 'blob' | 'json' | 'text';
}): Promise<Result> => {
  const http = inject(HttpClient);
  return lastValueFrom(
    http.request(method, url, {
      params,
      body: data,
      responseType: (responseType ?? 'json') as 'json',
    }),
  ) as Promise<Result>;
};

export default customAngularInstance;
