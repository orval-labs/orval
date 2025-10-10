import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const responseType = <Result>(
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
    headers?: any;
  },
  http: HttpClient,
): Observable<Result> =>
  http.request<Result>(method, url, {
    params,
    body: data,
    responseType: 'json',
  });

export default responseType;
