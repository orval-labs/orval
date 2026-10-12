import { HTTP_STATUS_CODE_SHARED_TYPES } from '@orval/core';

import { GET_HEADERS_HELPER } from './fragments';

const statusCodeTypes = HTTP_STATUS_CODE_SHARED_TYPES.map(
  ({ code }) => `export ${code}`,
).join('\n');

/**
 * The shared fetch runtime, generated once per project at
 * `override.fetch.runtimeOutputPath`. It holds no configuration, so every
 * output of the same orval version writes the same bytes.
 */
export const RUNTIME_TEMPLATE = `${statusCodeTypes}

export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'HEAD'
  | 'OPTIONS';

/** Per-call options: RequestInit plus a call-scoped fetch implementation. */
export type CallOptions = RequestInit & { fetch?: typeof globalThis.fetch };

export interface ExecuteArgs {
  url: string;
  method: HttpMethod;
  body?: unknown;
  /**
   * Media type of the request body, as declared by the spec. Selects the
   * encoding (JSON.stringify for JSON media types, \`encodeBody\` for
   * multipart/form-data and application/x-www-form-urlencoded, the raw value
   * otherwise) and becomes the Content-Type header, except for
   * multipart/form-data whose boundary is left to fetch.
   */
  contentType?: string;
  /** Header parameters declared by the spec. \`options.headers\` wins. */
  headers?: HeadersInit;
  /**
   * How the response body is decoded. The default parses JSON and yields \`{}\`
   * for an empty body.
   * - 'void'   — parse by content-type, an empty body yields undefined
   * - 'text'   — the body as text
   * - 'auto'   — parse by content-type (responses with mixed media types)
   * - 'blob'   — the body as a Blob, null when empty
   * - 'stream' — the Response itself, left undecoded
   */
  responseType?: 'void' | 'text' | 'auto' | 'blob' | 'stream';
  /** Spec-driven body encoder (FormData / URLSearchParams). */
  encodeBody?: (body: never) => BodyInit;
  options?: CallOptions;
}

/** Spec-level configuration, embedded by the generated client config. */
export interface ClientConfig {
  /** Replaces the whole request pipeline, with the inline client's contract. */
  mutator?: <T>(url: string, init: RequestInit) => Promise<T>;
}

export interface TypedResponse<T> extends Response {
  json(): Promise<T>;
}

/** Marks a streamed (ndjson) response in a \`ResponseOf\` map. Never constructed. */
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

/**
 * The response union of an operation, derived from its status → body map.
 * Keys are exact statuses, wildcards ('2XX') or 'default'; a \`Stream<T>\`
 * value marks a streamed response.
 */
export type ResponseOf<R> = {
  [K in keyof R]: R[K] extends Stream<infer T>
    ? { stream: TypedResponse<T>; status: StatusFor<R, K>; headers: Headers }
    : { data: R[K]; status: StatusFor<R, K>; headers: Headers };
}[keyof R];

/** The member of a response union matching a status code. */
export type StatusOf<Res, S extends number> = Res extends {
  status: infer St extends number;
}
  ? S extends St
    ? Res
    : never
  : never;

export interface QueryMeta {
  /** Array parameters serialized as repeated keys (\`explode: true\`). */
  explode?: string[];
  /** Array parameters serialized as repeated keys (\`arrayFormat: 'repeat'\`). */
  repeat?: string[];
  /** Array parameters serialized as \`key[]=\` (\`arrayFormat: 'brackets'\`). */
  brackets?: string[];
  /** Array parameters serialized comma-joined (\`arrayFormat: 'comma'\`). */
  comma?: string[];
  /** Object parameters serialized as \`key[prop]=\` (\`style: deepObject\`). */
  deepObject?: string[];
}

const stringifyValue = (value: unknown) =>
  value === null
    ? 'null'
    : value instanceof Date
      ? value.toISOString()
      : String(value);

/** Serializes query parameters the way the inline client's URL builders do. */
export const serializeQuery = (
  params: Record<string, unknown> | undefined,
  meta: QueryMeta = {},
): string => {
  const normalizedParams = new URLSearchParams();
  const deepObjectEntries: string[] = [];

  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
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
          deepObjectEntries.push(
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

  return [normalizedParams.toString(), deepObjectEntries.join('&')]
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

/**
 * Executes one request. \`R\` is the response union declared by the generated
 * code; the runtime does not verify it. \`config\` is the internal seam for the
 * generated client config of a spec that uses a mutator.
 */
export const execute = async <R>(
  args: ExecuteArgs,
  config?: ClientConfig,
): Promise<R> => {
  const { fetch: fetchFn = globalThis.fetch, ...options } = args.options ?? {};
  const body = encodeRequestBody(args);
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
    ...(body !== undefined ? { body } : {}),
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

/** The per-spec client config wiring a global mutator to the shared runtime. */
export const clientConfigTemplate = ({
  runtimeImportPath,
  mutatorImport,
  mutatorName,
}: {
  runtimeImportPath: string;
  /** The full import statement of the mutator, as the inline client emits it. */
  mutatorImport: string;
  mutatorName: string;
}) => `import * as runtime from '${runtimeImportPath}';
import type { ExecuteArgs } from '${runtimeImportPath}';
${mutatorImport}
const config = { mutator: ${mutatorName} };

export const execute = <R>(args: ExecuteArgs) =>
  runtime.execute<R>(args, config);
`;
