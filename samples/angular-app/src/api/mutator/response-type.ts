import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export const responseType = <Result>(
  {
    url,
    method,
    params,
    data,
  }: {
    url: string;
    method: string;
    params?: any;
    data?: any;
  },
  http: HttpClient,
): Observable<Result> =>
  http.request<Result>(method, url, { params, body: data });
