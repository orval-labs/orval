import http from 'node:http';
import https from 'node:https';
export type Response<T = Record<string, unknown>> = {
    status: http.IncomingMessage['statusCode'];
    headers: http.IncomingMessage['headers'];
    body: T;
};
export declare const request: <T>(urlOptions: string | https.RequestOptions | URL, data?: string) => Promise<Response<T>>;
//# sourceMappingURL=request.d.ts.map