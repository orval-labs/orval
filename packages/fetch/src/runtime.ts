import { HTTP_STATUS_CODE_SHARED_TYPES } from '@orval/core';

// `RequestInit['headers']` is declared per runtime, and the old narrowing
// chain only fitted the DOM's declaration, leaving `return h` unsound in two
// separate ways:
//
//  - Outside the DOM the non-record member need not be an array —
//    `@cloudflare/workers-types` uses `Iterable<Iterable<string>>`, which
//    `Array.isArray` cannot exclude (#4034). Narrowing on iterability covers
//    every declaration, since the record is the only non-iterable member.
//    That also fixes the runtime half: spreading an iterable as an object
//    silently dropped every header. Each entry is materialized because
//    `Object.fromEntries` reads `[0]`/`[1]` rather than iterating, so a
//    non-indexable entry (`new Set([new Set(['X-Trace', '1'])])`) would
//    otherwise yield a single `undefined` key and lose the real header.
//  - The record member's values are not always `string`. Hono's header
//    record admits `undefined` (#4029), which the declared return type does
//    not. Building the result entry by entry keeps that guarantee by
//    construction, and skipping the `undefined` values is what the caller
//    wants anyway: passed through, they reach the wire as the literal text
//    "undefined".
export const GET_HEADERS_HELPER = `  const getHeaders = (h?: NonNullable<RequestInit['headers']>): Record<string, string | readonly string[]> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    if (Symbol.iterator in h) {
      return Object.fromEntries(
        Array.from(h as Iterable<Iterable<string>>, (entry) => Array.from(entry) as [string, string]),
      );
    }
    const headers: Record<string, string | readonly string[]> = {};
    for (const [name, value] of Object.entries<string | readonly string[] | undefined>(h)) {
      if (value !== undefined) headers[name] = value;
    }
    return headers;
  };
`;

const statusCodeTypes = HTTP_STATUS_CODE_SHARED_TYPES.map(
  ({ code }) => `export ${code}`,
).join('\n');

export const RUNTIME_TEMPLATE = `${statusCodeTypes}

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

export type CallOptions = RequestInit & { fetch?: typeof globalThis.fetch };

export interface ExecuteArgs {
  url: string;
  method: HttpMethod;
  body?: unknown;
  contentType?: string;
  headers?: HeadersInit;
  responseType?: 'void' | 'text' | 'auto' | 'blob' | 'stream';
  encodeBody?: (body: never) => BodyInit;
  options?: CallOptions;
}

export interface ClientConfig {
  mutator?: <T>(url: string, init: RequestInit) => Promise<T>;
}

export interface TypedResponse<T> extends Response {
  json(): Promise<T>;
}

export interface Stream<T> {
  readonly __orvalStream: T;
}

type WildcardKey = '1XX' | '2XX' | '3XX' | '4XX' | '5XX';
type WildcardStatus<K> = K extends '1XX'
  ? HTTPStatusCode1xx
  : K extends '2XX'
    ? HTTPStatusCode2xx
    : K extends '3XX'
      ? HTTPStatusCode3xx
      : K extends '4XX'
        ? HTTPStatusCode4xx
        : K extends '5XX'
          ? HTTPStatusCode5xx
          : never;
type DeclaredStatuses<R> = {
  [K in Exclude<keyof R, 'default'>]: StatusFor<R, K>;
}[Exclude<keyof R, 'default'>];
type StatusFor<R, K extends keyof R> = K extends number
  ? K
  : K extends WildcardKey
    ? Exclude<WildcardStatus<K>, Extract<keyof R, number>>
    : K extends 'default'
      ? [Exclude<keyof R, 'default'>] extends [never]
        ? number
        : Exclude<HTTPStatusCodes, DeclaredStatuses<R>>
      : never;

export type ResponseOf<R> = {
  [K in keyof R]: R[K] extends Stream<infer T>
    ? { stream: TypedResponse<T>; status: StatusFor<R, K>; headers: Headers }
    : { data: R[K]; status: StatusFor<R, K>; headers: Headers };
}[keyof R];

export type StatusOf<Res, S extends number> = Res extends {
  status: infer St extends number;
}
  ? S extends St
    ? Res
    : never
  : never;

export interface QueryMeta {
  explode?: string[];
  repeat?: string[];
  brackets?: string[];
  comma?: string[];
  pipeDelimited?: string[];
  spaceDelimited?: string[];
  deepObject?: string[];
}

const stringifyValue = (value: unknown) =>
  value === null
    ? 'null'
    : value instanceof Date
      ? value.toISOString()
      : Array.isArray(value)
        ? value.join(',')
        : typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ? String(value)
          : JSON.stringify(value);

export const serializeQuery = (
  params: Record<string, unknown> | undefined,
  meta: QueryMeta = {},
): string => {
  const normalizedParams = new URLSearchParams();
  // Pre-encoded entries that bypass URLSearchParams.
  const encodedEntries: string[] = [];

  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      // Joined with a percent-encoded separator; URLSearchParams would write
      // the space as '+'.
      const delimiter = meta.pipeDelimited?.includes(key)
        ? '%7C'
        : meta.spaceDelimited?.includes(key)
          ? '%20'
          : undefined;
      if (delimiter) {
        encodedEntries.push(
          encodeURIComponent(key) +
            '=' +
            value
              .map((v) => encodeURIComponent(stringifyValue(v)))
              .join(delimiter),
        );
        return;
      }
      if (meta.explode?.includes(key) || meta.repeat?.includes(key)) {
        value.forEach((v) => {
          normalizedParams.append(key, stringifyValue(v));
        });
        return;
      }
      if (meta.brackets?.includes(key)) {
        value.forEach((v) => {
          normalizedParams.append(key + '[]', stringifyValue(v));
        });
        return;
      }
      if (meta.comma?.includes(key)) {
        normalizedParams.append(key, value.map(stringifyValue).join(','));
        return;
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      meta.deepObject?.includes(key)
    ) {
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subValue !== undefined) {
          encodedEntries.push(
            encodeURIComponent(key) +
              '[' +
              encodeURIComponent(subKey) +
              ']=' +
              (subValue === null
                ? 'null'
                : encodeURIComponent(stringifyValue(subValue))),
          );
        }
      });
      return;
    }

    if (value !== undefined) {
      normalizedParams.append(key, stringifyValue(value));
    }
  });

  return [normalizedParams.toString(), encodedEntries.join('&')]
    .filter(Boolean)
    .join('&');
};

${GET_HEADERS_HELPER.replace(/^ {2}/gm, '')}
const encodeRequestBody = (args: ExecuteArgs): BodyInit | undefined => {
  if (args.body === undefined) return undefined;
  if (args.encodeBody) return args.encodeBody(args.body as never);
  if (!args.contentType || args.contentType.toLowerCase().includes('json')) {
    return JSON.stringify(args.body);
  }
  return args.body as BodyInit;
};

const decodeResponseBody = async (
  res: Response,
  responseType: ExecuteArgs['responseType'],
): Promise<unknown> => {
  if (responseType === 'blob') {
    return [204, 205, 304].includes(res.status) ? null : await res.blob();
  }

  const body = [204, 205, 304].includes(res.status) ? null : await res.text();

  if (responseType === 'text') return body !== null ? body : '';

  if (responseType === 'auto' || responseType === 'void') {
    if (!body) return responseType === 'void' ? undefined : {};
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    return contentType.includes('json') ? JSON.parse(body) : body;
  }

  return body ? JSON.parse(body) : {};
};

export const execute = async <R>(
  args: ExecuteArgs,
  config?: ClientConfig,
): Promise<R> => {
  const { fetch: fetchFn = globalThis.fetch, ...options } = args.options ?? {};
  const init: RequestInit = {
    ...options,
    method: args.method,
    headers: {
      ...(args.contentType && args.contentType !== 'multipart/form-data'
        ? { 'Content-Type': args.contentType }
        : {}),
      ...getHeaders(args.headers),
      ...getHeaders(options.headers),
    },
    body: encodeRequestBody(args),
  };

  if (config?.mutator) {
    return config.mutator<R>(args.url, init);
  }

  const res = await fetchFn(args.url, init);

  if (args.responseType === 'stream') {
    return { status: res.status, stream: res, headers: res.headers } as R;
  }

  const data = await decodeResponseBody(res, args.responseType);
  return { data, status: res.status, headers: res.headers } as R;
};
`;

export const clientConfigTemplate = ({
  runtimeImportPath,
  mutatorImport,
  mutatorName,
}: {
  runtimeImportPath: string;
  mutatorImport: string;
  mutatorName: string;
}) => `import * as runtime from '${runtimeImportPath}';
import type { ExecuteArgs } from '${runtimeImportPath}';
${mutatorImport}
const config = { mutator: ${mutatorName} };

export const execute = <R>(args: ExecuteArgs) =>
  runtime.execute<R>(args, config);
`;
