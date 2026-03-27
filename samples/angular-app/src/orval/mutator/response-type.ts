import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

type QueryParamValue = string | number | boolean;

const responseType = <Result>(
  {
    url,
    method,
    params,
    data,
  }: {
    url: string;
    method: string;
    params?: HttpParams | Record<string, QueryParamValue | QueryParamValue[]>;
    data?: unknown;
    headers?: Record<string, string | string[]>;
  },
  http: HttpClient,
): Observable<Result> =>
  http.request<Result>(method, url, {
    params,
    body: data,
    responseType: 'json',
  });

export default responseType;
