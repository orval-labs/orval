import http from 'http';
import https from 'https';
export type Response<T = {
    [key: string]: unknown;
}> = {
    status: http.IncomingMessage['statusCode'];
    headers: http.IncomingMessage['headers'];
    body: T;
};
export declare const request: <T>(urlOptions: string | https.RequestOptions | URL, data?: string) => Promise<Response<T>>;
//# sourceMappingURL=request.d.ts.map