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
  readonly headers?: HttpHeaders | Record<string, string | string[]>;
  readonly context?: HttpContext;
  readonly params?:
        | HttpParams
      | Record<string, string | number | boolean | Array<string | number | boolean>>;
  readonly reportProgress?: boolean;
  readonly withCredentials?: boolean;
  readonly credentials?: RequestCredentials;
  readonly keepalive?: boolean;
  readonly priority?: RequestPriority;
  readonly cache?: RequestCache;
  readonly mode?: RequestMode;
  readonly redirect?: RequestRedirect;
  readonly referrer?: string;
  readonly integrity?: string;
  readonly referrerPolicy?: ReferrerPolicy;
  readonly transferCache?: {includeHeaders?: string[]} | boolean;
  readonly timeout?: number;
}`;

const HTTP_CLIENT_BODY_OPTIONS_TEMPLATE = `type HttpClientBodyOptions = HttpClientOptions & {
  readonly observe?: 'body';
};`;

const HTTP_CLIENT_EVENT_RESPONSE_OPTIONS_TEMPLATE = `type HttpClientEventOptions = HttpClientOptions & {
  readonly observe: 'events';
};

type HttpClientResponseOptions = HttpClientOptions & {
  readonly observe: 'response';
};`;

const HTTP_CLIENT_OBSERVE_UNION_OPTIONS_TEMPLATE = `type HttpClientObserveOptions = HttpClientOptions & {
  readonly observe?: 'body' | 'events' | 'response';
};`;

/**
 * Code templates for reusable observe option helpers emitted into generated files.
 */
export const HTTP_CLIENT_OBSERVE_OPTIONS_TEMPLATE = `${HTTP_CLIENT_BODY_OPTIONS_TEMPLATE}

${HTTP_CLIENT_EVENT_RESPONSE_OPTIONS_TEMPLATE}

${HTTP_CLIENT_OBSERVE_UNION_OPTIONS_TEMPLATE}`;

/**
 * Same as {@link HTTP_CLIENT_OBSERVE_OPTIONS_TEMPLATE} without the `events` and
 * `response` helpers, which are only referenced by the observe overloads
 * (`override.angular.observeOverloads`).
 */
export const HTTP_CLIENT_BODY_OBSERVE_OPTIONS_TEMPLATE = `${HTTP_CLIENT_BODY_OPTIONS_TEMPLATE}

${HTTP_CLIENT_OBSERVE_UNION_OPTIONS_TEMPLATE}`;

/**
 * Code template for the `ThirdParameter` utility type used with custom mutators.
 */
export const THIRD_PARAMETER_TEMPLATE = `// eslint-disable-next-line
    type ThirdParameter<T extends (...args: never[]) => unknown> = T extends (
  config: unknown,
  httpClient: unknown,
  args: infer P,
) => unknown
  ? P
  : never;`;
