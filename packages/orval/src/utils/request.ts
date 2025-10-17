import http from 'node:http';
import https from 'node:https';

export type Response<T = Record<string, unknown>> = {
  status: http.IncomingMessage['statusCode'];
  headers: http.IncomingMessage['headers'];
  body: T;
};

export const request = <T>(
  urlOptions: string | https.RequestOptions | URL,
  data?: string,
): Promise<Response<T>> => {
  return new Promise((resolve, reject) => {
    const req = https.request(urlOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk.toString()));
      res.on('error', reject);
      res.on('end', () => {
        const response = {
          status: res.statusCode,
          headers: res.headers,
          body: JSON.parse(body),
        };
        if (res.statusCode && res.statusCode >= 200 && res.statusCode <= 299) {
          resolve(response);
        } else {
          reject(response);
        }
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(data, 'binary');
    }
    req.end();
  });
};
