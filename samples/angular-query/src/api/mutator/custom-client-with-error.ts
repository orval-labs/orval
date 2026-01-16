import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { lastValueFrom } from 'rxjs';

export interface ExtendedServerErrorResponse<Error> extends HttpErrorResponse {
  error: Error | any | null;
}

export type ErrorType<Error> = ExtendedServerErrorResponse<Error>;

/**
 * Custom Angular mutator for Orval.
 *
 * Orval detects `hasSecondArg: true` from the function signature and generates
 * code that injects HttpClient and passes it as the second parameter.
 *
 * Note: http is typed as optional because the generated operation functions
 * (e.g., listPets) are exported with optional params. The inject* functions
 * and get*QueryOptions/get*MutationOptions always provide http.
 *
 * The ErrorType export is automatically picked up by Orval and used as the
 * error type for all generated query/mutation functions.
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
  if (!http) {
    throw new Error(
      'HttpClient is required. Use inject* functions or pass HttpClient explicitly.',
    );
  }
  return lastValueFrom(
    http.request<Result>(method, url, {
      params,
      body: data,
      responseType: (responseType ?? 'json') as 'json',
    }),
  );
};

export default responseType;
