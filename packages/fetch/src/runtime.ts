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

// A union of more than eight codes is split into private aliases of eight,
// which a formatter keeps on one line each instead of one line per code.
const STATUS_CODES_PER_LINE = 8;
// `HTTPStatusCodes` is derived from the wildcard lookup in the template.
const statusCodeTypes = HTTP_STATUS_CODE_SHARED_TYPES.filter(
  ({ name }) => name !== 'HTTPStatusCodes',
)
  .map(({ name, code }) => {
    const codes = code.match(/\b[1-5]\d\d\b/g) ?? [];
    if (codes.length <= STATUS_CODES_PER_LINE) return `export ${code}`;
    const parts = Array.from(
      { length: Math.ceil(codes.length / STATUS_CODES_PER_LINE) },
      (_, index) => ({
        name: `${name}${String.fromCodePoint(65 + index)}`,
        codes: codes.slice(
          index * STATUS_CODES_PER_LINE,
          (index + 1) * STATUS_CODES_PER_LINE,
        ),
      }),
    );
    return [
      ...parts.map((part) => `type ${part.name} = ${part.codes.join(' | ')};`),
      `export type ${name} = ${parts.map((part) => part.name).join(' | ')};`,
    ].join('\n');
  })
  .join('\n');

// The runtime names fetch types only through `RequestInit`: `BodyInit` and
// `HeadersInit` are DOM-lib globals that other runtimes, such as Bun, don't
// declare (#4344). `ClientConfig.mutator` types `schema` as optional `never`:
// a mutator typed for `includeZodSchemaInArguments` may declare any optional
// `schema` (`schema?: ZodType`), but not a required one, since operations
// without a validated response pass none.
//
// The template carries no comments of its own, since they would ship in every
// generated runtime. In `serializeQuery`, `encodedEntries` are pre-encoded and
// bypass `URLSearchParams`: delimited arrays are joined with a percent-encoded
// separator (URLSearchParams would write a space as '+'), and deepObject
// params keep their brackets. Plain-object form params are flattened into
// their own keys, or written as one key of comma-joined prop,value pairs. In
// `execute`, a download's error body is text, decoded by the declared error
// media types (`errorResponseType`).
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

export interface ExecuteArgs<Options extends object = CallOptions> {
  url: string;
  method: HttpMethod;
  body?: unknown;
  contentType?: string;
  headers?: RequestInit['headers'];
  responseType?: 'void' | 'text' | 'auto' | 'blob' | 'stream';
  encodeBody?: (body: never) => NonNullable<RequestInit['body']>;
  reviver?: (key: string, value: unknown) => unknown;
  deserializeResponseDates?: (data: unknown, status: number) => unknown;
  validateResponse?: (data: unknown, status: number) => unknown;
  throwOnError?: boolean;
  returnData?: boolean;
  serializeResponseHeaders?: boolean;
  schema?: unknown;
  errorResponses?: ErrorResponseMeta[];
  errorResponseType?: 'text' | 'auto';
  options?: Options & CallOptions;
}

export interface ErrorResponseMeta {
  status: number;
  contentType: string;
}

export interface ClientConfig {
  mutator?: <T>(
    url: string,
    init: RequestInit & { schema?: never },
    meta: { errorResponses: ErrorResponseMeta[] },
  ) => Promise<T>;
}

export interface TypedResponse<T> extends Response {
  json(): Promise<T>;
}

export interface Stream<T> {
  readonly __orvalStream: T;
}

type WildcardStatus = {
  '1XX': HTTPStatusCode1xx;
  '2XX': HTTPStatusCode2xx;
  '3XX': HTTPStatusCode3xx;
  '4XX': HTTPStatusCode4xx;
  '5XX': HTTPStatusCode5xx;
};
type WildcardKey = keyof WildcardStatus;
export type HTTPStatusCodes = WildcardStatus[WildcardKey];
type DeclaredStatuses<R> = {
  [K in Exclude<keyof R, 'default'>]: StatusFor<R, K>;
}[Exclude<keyof R, 'default'>];
type StatusFor<R, K extends keyof R> = K extends number
  ? K
  : K extends WildcardKey
    ? Exclude<WildcardStatus[K], Extract<keyof R, number>>
    : K extends 'default'
      ? [Exclude<keyof R, 'default'>] extends [never]
        ? number
        : Exclude<HTTPStatusCodes, DeclaredStatuses<R>>
      : never;

export type ResponseOf<R, H = Headers, Keys extends keyof R = keyof R> = {
  [K in Keys]: R[K] extends Stream<infer T>
    ? { stream: TypedResponse<T>; status: StatusFor<R, K>; headers: H }
    : { data: R[K]; status: StatusFor<R, K>; headers: H };
}[Keys];

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
  flattenObject?: string[];
  commaObject?: string[];
}

const stringifyValue = (value: unknown) =>
  value instanceof Date
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
  const encodedEntries: string[] = [];

  Object.entries(params || {}).forEach(([key, value]) => {
    if (Array.isArray(value)) {
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
      const repeated = meta.explode?.includes(key) || meta.repeat?.includes(key);
      if (repeated || meta.brackets?.includes(key)) {
        const name = repeated ? key : key + '[]';
        value.forEach((v) => normalizedParams.append(name, stringifyValue(v)));
        return;
      }
      if (meta.comma?.includes(key)) {
        normalizedParams.append(key, value.map(stringifyValue).join(','));
        return;
      }
    } else if (
      typeof value === 'object' &&
      value !== null &&
      !(value instanceof Date) &&
      (meta.flattenObject?.includes(key) || meta.commaObject?.includes(key))
    ) {
      const commaParts: string[] = [];
      Object.entries(value).forEach(([subKey, subValue]) => {
        const items = (Array.isArray(subValue) ? subValue : [subValue])
          .filter((v) => v !== undefined)
          .map(stringifyValue);
        if (meta.flattenObject?.includes(key)) {
          items.forEach((item) => normalizedParams.append(subKey, item));
        } else if (items.length > 0) {
          commaParts.push(subKey, ...items);
        }
      });
      if (commaParts.length > 0) {
        normalizedParams.append(key, commaParts.join(','));
      }
      return;
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
              encodeURIComponent(stringifyValue(subValue)),
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
const encodeRequestBody = (args: ExecuteArgs): RequestInit['body'] => {
  if (args.body === undefined) return undefined;
  if (args.encodeBody) return args.encodeBody(args.body as never);
  if (!args.contentType || args.contentType.toLowerCase().includes('json')) {
    return JSON.stringify(args.body);
  }
  return args.body as NonNullable<RequestInit['body']>;
};

const getResponseHeaders = (res: Response, args: ExecuteArgs) =>
  args.serializeResponseHeaders
    ? Object.fromEntries(
        [...res.headers.entries()].filter(([name]) => name !== 'set-cookie'),
      )
    : res.headers;

const decodeResponseBody = async (
  res: Response,
  {
    responseType,
    reviver,
    deserializeResponseDates,
    validateResponse,
  }: ExecuteArgs,
): Promise<unknown> => {
  const parseJson = (body: string) => {
    const data: unknown = JSON.parse(body, reviver);
    return deserializeResponseDates
      ? deserializeResponseDates(data, res.status)
      : data;
  };

  if (responseType === 'blob') {
    return [204, 205, 304].includes(res.status) ? null : await res.blob();
  }

  const body = [204, 205, 304].includes(res.status) ? null : await res.text();

  if (responseType === 'text') return body !== null ? body : '';

  if (responseType === 'auto' || responseType === 'void' || validateResponse) {
    const empty = responseType === 'void' ? undefined : {};
    const contentType = (res.headers.get('content-type') ?? '').toLowerCase();
    if (!contentType.includes('json')) return body ? body : empty;
    const data = body ? parseJson(body) : empty;
    return validateResponse ? validateResponse(data, res.status) : data;
  }

  return body ? parseJson(body) : {};
};

export const prepareRequest = <Options extends object = CallOptions>(args: ExecuteArgs<Options>) => {
  const callOptions: CallOptions = args.options ?? {};
  const { fetch: fetchFn = globalThis.fetch, ...options } = callOptions;
  const init: RequestInit = {
    ...options,
    method: args.method,
    headers: {
      ...(args.contentType && args.contentType !== 'multipart/form-data'
        ? { 'Content-Type': args.contentType }
        : {}),
      ...getHeaders(args.headers),
      ...getHeaders(args.options?.headers),
    },
  };
  const body = encodeRequestBody(args);
  if (body === undefined) delete init.body;
  else init.body = body;

  return { fetchFn, init };
};

export const execute = async <R>(
  args: ExecuteArgs,
  config?: ClientConfig,
): Promise<R> => {
  const { fetchFn, init } = prepareRequest(args);

  if (config?.mutator) {
    const mutatorInit =
      args.schema === undefined
        ? init
        : { ...init, schema: args.schema as never };
    return config.mutator<R>(args.url, mutatorInit, {
      errorResponses: args.errorResponses ?? [],
    });
  }

  const res = await fetchFn(args.url, init);

  if (args.throwOnError && !res.ok) {
    const err: globalThis.Error & { info?: unknown; status?: number } =
      new globalThis.Error();
    const {
      deserializeResponseDates: _deserializeResponseDates,
      validateResponse: _validateResponse,
      responseType: _responseType,
      ...errorArgs
    } = args;
    const responseType =
      args.responseType === 'blob' ? args.errorResponseType : args.responseType;
    err.info = await decodeResponseBody(res, {
      ...errorArgs,
      ...(responseType !== undefined ? { responseType } : {}),
    });
    err.status = res.status;
    throw err;
  }

  if (args.responseType === 'stream') {
    if (args.returnData) return res as R;
    const headers = getResponseHeaders(res, args);
    return { status: res.status, stream: res, headers } as R;
  }

  const data = await decodeResponseBody(res, args);
  if (args.returnData) return data as R;
  const headers = getResponseHeaders(res, args);
  return { data, status: res.status, headers } as R;
};
`;

/**
 * Builds the global-mutator adapter. Inferred mutators are specialized by each
 * endpoint, so this module preserves their constraints and actual return types.
 */
export const clientConfigTemplate = ({
  runtimeImportPath,
  mutatorImport,
  mutatorName,
  inferred = false,
  hasSecondArg = true,
  hasThirdArg = false,
  mutatorAlias = `${mutatorName}Fetcher`,
}: {
  runtimeImportPath: string;
  mutatorImport: string;
  mutatorName: string;
  inferred?: boolean;
  hasSecondArg?: boolean;
  hasThirdArg?: boolean;
  mutatorAlias?: string;
}) => {
  // Like the non-inferred config, a three-argument mutator always receives the
  // error responses, empty when the operation declares none.
  const passesErrorResponses = inferred && hasSecondArg && hasThirdArg;
  const imports = `import * as runtime from '${runtimeImportPath}';
import type { ${passesErrorResponses ? 'ErrorResponseMeta, ' : ''}ExecuteArgs } from '${runtimeImportPath}';
${mutatorImport}
`;
  if (inferred) {
    return `${imports}export { ${mutatorName} as ${mutatorAlias} };

export type CallOptions = ${hasSecondArg ? `Parameters<typeof ${mutatorName}>[1]` : 'RequestInit'};
${hasSecondArg ? '\ntype MutatorOptions = RequestInit & Partial<NonNullable<CallOptions>>;\n' : ''}
export const execute = <Result>(
  args: ExecuteArgs<NonNullable<CallOptions>>,
  fetcher: (url: string${hasSecondArg ? ', options: MutatorOptions' : ''}${passesErrorResponses ? ', meta: { errorResponses: ErrorResponseMeta[] }' : ''}) => Result,
) => {
  ${
    hasSecondArg
      ? `const { init } = runtime.prepareRequest(args);
  const options = { ...args.options, ...init };
  if (init.body === undefined) delete options.body;
  const mutatorOptions = args.schema === undefined ? options : { ...options, schema: args.schema as never };
  return fetcher(args.url, mutatorOptions${passesErrorResponses ? ', { errorResponses: args.errorResponses ?? [] }' : ''});`
      : 'return fetcher(args.url);'
  }
};
`;
  }
  return `${imports}const config = { mutator: ${mutatorName} };

export const execute = <R>(args: ExecuteArgs) =>
  runtime.execute<R>(args, config);
`;
};
