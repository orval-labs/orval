/**
 * Code template for the `HttpClientOptions` interface emitted into generated files.
 *
 * This is NOT an import of Angular's type — Angular's HttpClient methods accept
 * inline option objects, not a single unified interface. Orval generates this
 * convenience wrapper so users have a single referenceable type.
 *
 * Properties sourced from Angular HttpClient public API (angular/angular
 * packages/common/http/src/client.ts).
 */
export const HTTP_CLIENT_OPTIONS_TEMPLATE = `interface HttpClientOptions {
  headers?: HttpHeaders | Record<string, string | string[]>;
  context?: HttpContext;
  params?:
        | HttpParams
        | Record<string, string | number | boolean | ReadonlyArray<string | number | boolean>>;
  reportProgress?: boolean;
  withCredentials?: boolean;
  credentials?: RequestCredentials;
  keepalive?: boolean;
  priority?: RequestPriority;
  cache?: RequestCache;
  mode?: RequestMode;
  redirect?: RequestRedirect;
  referrer?: string;
  integrity?: string;
  referrerPolicy?: ReferrerPolicy;
  transferCache?: {includeHeaders?: string[]} | boolean;
  timeout?: number;
}`;

/**
 * Code template for the `ThirdParameter` utility type used with custom mutators.
 */
export const THIRD_PARAMETER_TEMPLATE = `// eslint-disable-next-line
    type ThirdParameter<T extends (...args: any) => any> = T extends (
  config: any,
  httpClient: any,
  args: infer P,
) => any
  ? P
  : never;`;
