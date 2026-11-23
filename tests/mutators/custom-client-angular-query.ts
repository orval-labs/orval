import type { HttpClient } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

// An angular-query mutator: TanStack Query needs a Promise, so it resolves the
// `HttpClient` Observable.
export const customClient = <Result>(
  {
    url,
    method,
    params,
    data,
  }: {
    url: string;
    method: string;
    params?: Record<
      string,
      string | number | boolean | ReadonlyArray<string | number | boolean>
    >;
    data?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
  },
  http?: HttpClient,
): Promise<Result> => {
  if (!http) {
    throw new Error('HttpClient is required.');
  }
  return lastValueFrom(
    http.request<Result>(method, url, {
      params,
      body: data,
      responseType: 'json',
    }),
  );
};
