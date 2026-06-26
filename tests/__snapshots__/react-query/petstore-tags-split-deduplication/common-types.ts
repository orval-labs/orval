export type HTTPStatusCode1xx = 100 | 101 | 102 | 103;
export type HTTPStatusCode2xx = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207;
export type HTTPStatusCode3xx = 300 | 301 | 302 | 303 | 304 | 305 | 307 | 308;
export type HTTPStatusCode4xx =
  | 400
  | 401
  | 402
  | 403
  | 404
  | 405
  | 406
  | 407
  | 408
  | 409
  | 410
  | 411
  | 412
  | 413
  | 414
  | 415
  | 416
  | 417
  | 418
  | 419
  | 420
  | 421
  | 422
  | 423
  | 424
  | 426
  | 428
  | 429
  | 431
  | 451;
export type HTTPStatusCode5xx = 500 | 501 | 502 | 503 | 504 | 505 | 507 | 511;
export type HTTPStatusCodes =
  | HTTPStatusCode1xx
  | HTTPStatusCode2xx
  | HTTPStatusCode3xx
  | HTTPStatusCode4xx
  | HTTPStatusCode5xx;
