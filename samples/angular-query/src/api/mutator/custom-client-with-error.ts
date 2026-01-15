import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { lastValueFrom } from 'rxjs';

export interface ExtendedServerErrorResponse<Error> extends HttpErrorResponse {
  error: Error | any | null;
}

export type ErrorType<Error> = ExtendedServerErrorResponse<Error>;

/**
 * Custom Angular mutator that can receive HttpClient as optional second parameter.
 * If not provided, it will inject HttpClient from the current injection context.
 *
 * This pattern works because:
 * 1. When called from inject* hooks, we're in injection context (inject works)
 * 2. When http is passed explicitly, we use that
 */
export const responseType = <Result>(
  {
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
  },
  http?: HttpClient,
): Promise<Result> => {
  // Use provided http or inject it from current context
  const httpClient = http ?? inject(HttpClient);

  return lastValueFrom(
    httpClient.request<Result>(method, url, {
      params,
      body: data,
      responseType: (responseType ?? 'json') as 'json',
    }),
  );
};

export default responseType;
