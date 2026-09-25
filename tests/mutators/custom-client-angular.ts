import type { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';

type AngularQueryParams = Record<
  string,
  string | number | boolean | ReadonlyArray<string | number | boolean>
>;

type AngularHeaders = Record<string, string | readonly string[]>;

const responseType = <Result>(
  {
    url,
    method,
    params,
    data,
  }: {
    url: string;
    method: string;
    params?: AngularQueryParams;
    data?: unknown;
    headers?: AngularHeaders;
  },
  http: HttpClient,
): Observable<Result> =>
  http.request<Result>(method, url, {
    params,
    body: data,
    responseType: 'json',
  });

export default responseType;
