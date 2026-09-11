import type { SharedTypeDeclaration } from '../types';

const WILDCARD_STATUS_CODE_REGEX = /^[1-5]XX$/i;

export const getStatusCodeType = (key: string) => {
  if (WILDCARD_STATUS_CODE_REGEX.test(key)) {
    return `HTTPStatusCode${key[0]}xx`;
  }
  return key;
};

export const HTTP_STATUS_CODE_SHARED_TYPES: SharedTypeDeclaration[] = [
  {
    name: 'HTTPStatusCode1xx',
    exported: true,
    code: 'type HTTPStatusCode1xx = 100 | 101 | 102 | 103;',
  },
  {
    name: 'HTTPStatusCode2xx',
    exported: true,
    code: 'type HTTPStatusCode2xx = 200 | 201 | 202 | 203 | 204 | 205 | 206 | 207;',
  },
  {
    name: 'HTTPStatusCode3xx',
    exported: true,
    code: 'type HTTPStatusCode3xx = 300 | 301 | 302 | 303 | 304 | 305 | 307 | 308;',
  },
  {
    name: 'HTTPStatusCode4xx',
    exported: true,
    code: 'type HTTPStatusCode4xx = 400 | 401 | 402 | 403 | 404 | 405 | 406 | 407 | 408 | 409 | 410 | 411 | 412 | 413 | 414 | 415 | 416 | 417 | 418 | 419 | 420 | 421 | 422 | 423 | 424 | 426 | 428 | 429 | 431 | 451;',
  },
  {
    name: 'HTTPStatusCode5xx',
    exported: true,
    code: 'type HTTPStatusCode5xx = 500 | 501 | 502 | 503 | 504 | 505 | 507 | 511;',
  },
  {
    name: 'HTTPStatusCodes',
    exported: true,
    code: 'type HTTPStatusCodes = HTTPStatusCode1xx | HTTPStatusCode2xx | HTTPStatusCode3xx | HTTPStatusCode4xx | HTTPStatusCode5xx;',
  },
];

export const needsHttpStatusCodeTypes = (implementation: string) =>
  /HTTPStatusCode[1-5]xx|<HTTPStatusCodes,/.test(implementation);
