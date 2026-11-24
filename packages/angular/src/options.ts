import type {
  NormalizedRuntimeValidation,
  RuntimeValidationStrategy,
  VariableRuntimeValue,
} from '@orval/core';

/**
 * Opt-in config for `override.angular.baseUrl`: composes a runtime base URL
 * for a generated Angular output via Angular DI (an `InjectionToken`) rather
 * than baking a static prefix into every route at generation time.
 *
 * Angular-client only; mutually exclusive with the top-level `output.baseUrl`
 * (which bakes a prefix into every generated route string for ALL clients).
 * `apiId` is required and explicit — never derived from the spec — so the
 * generated identifiers (`<API_ID>_BASE_URL`, `provide<Api>BaseUrl`, ...) are
 * stable across regenerations and collision-free when multiple outputs are
 * generated into the same app.
 */
export interface AngularBaseUrlOptions {
  /** Explicit, stable identifier for this API, used to derive all generated DI token/helper names. Must match `/^[A-Za-z][A-Za-z0-9_-]*$/`. */
  apiId: string;
  /** Index into the specification's `servers` array to embed as the default fallback URL. Defaults to `0`. */
  index?: number;
  /** Values for any `{variable}` placeholders in the selected server URL. */
  variables?: Record<string, string | VariableRuntimeValue>;
}

/**
 * Angular's `runtimeValidation` surface. On top of the shared forms, the object
 * form can opt JSON request bodies into parsing before they are sent. The
 * object form enables response validation too, with `strategy` defaulting to
 * `throw`.
 */
export type AngularRuntimeValidation =
  | boolean
  | {
      strategy?: RuntimeValidationStrategy;
      /**
       * Parse JSON request bodies with the generated Zod schema before the
       * request is sent. `strategy` applies to request bodies as well.
       *
       * @default false
       */
      requestBodies?: boolean;
      /**
       * Validate through the Standard Schema interface (`schema['~standard']`)
       * instead of Zod's `parse`/`safeParse`.
       */
      standardSchema?: boolean;
    };

export interface NormalizedAngularRuntimeValidation extends NormalizedRuntimeValidation {
  /** Omitted is the same as `false`. */
  requestBodies?: boolean;
}

export interface AngularOptions {
  provideIn?: 'root' | 'any' | boolean;
  /**
   * Preferred name for configuring how retrieval-style operations are emitted.
   *
   * - `httpClient`: keep retrievals as service methods
   * - `httpResource`: emit retrievals as Angular `httpResource` helpers
   * - `both`: emit retrieval helpers and keep service methods where needed
   *
   * Mutation-style operations still use generated `HttpClient` service methods
   * by default unless a per-operation override forces a different behavior.
   */
  retrievalClient?: 'httpClient' | 'httpResource' | 'both';
  /**
   * Backward-compatible alias for `retrievalClient`.
   *
   * Kept for compatibility with existing configs.
   */
  client?: 'httpClient' | 'httpResource' | 'both';
  runtimeValidation?: AngularRuntimeValidation;
  httpResource?: AngularHttpResourceOptions;
  /**
   * Opt-in: compose the runtime base URL for this output via Angular DI
   * (an `InjectionToken`) instead of baking a static prefix into every
   * route at generation time. Angular-client only; mutually exclusive with
   * the top-level `output.baseUrl`.
   */
  baseUrl?: AngularBaseUrlOptions;
  /**
   * Controls how object-typed query parameters are serialized when no
   * `paramsSerializer` is configured.
   *
   * - `spec` (default): honor the OpenAPI parameter's `style`/`explode` —
   *   `form` + `explode: true` (the OpenAPI default) spreads the object's
   *   properties as top-level query params, `form` + `explode: false` joins
   *   them into a single comma-separated value, and `deepObject` emits
   *   bracketed `name[prop]` keys.
   * - `legacy`: restore the pre-#3705 behavior of silently dropping
   *   object-typed query params from the generated request.
   *
   * Has no effect when a `paramsSerializer` or `paramsFilter` is configured
   * for the operation — those remain in full control of the raw value. See
   * issue #3705.
   */
  queryObjectSerialization?: 'spec' | 'legacy';
  /**
   * Emit the `observe: 'body' | 'events' | 'response'` overloads on generated
   * `HttpClient` service methods.
   *
   * Set to `false` to emit only the `observe: 'body'` signature
   * (`Observable<TData>`), which keeps generated services easy to mock with
   * tools such as Vitest, Jasmine, Spectator or ng-mocks. See issue #4289.
   *
   * @default true
   */
  observeOverloads?: boolean;
}

export interface NormalizedAngularOptions {
  provideIn: 'root' | 'any' | boolean;
  client: 'httpClient' | 'httpResource' | 'both';
  runtimeValidation: NormalizedAngularRuntimeValidation;
  httpResource?: AngularHttpResourceOptions;
  baseUrl?: AngularBaseUrlOptions;
  queryObjectSerialization: 'spec' | 'legacy';
  /**
   * Always set at the output level; omitted on tag/operation overrides that
   * don't specify it so the output-level value is preserved when merged.
   */
  observeOverloads?: boolean;
}

export interface AngularHttpResourceOptions {
  /**
   * Value to expose while the resource is idle/loading.
   *
   * Serialized as a literal into generated code.
   */
  defaultValue?: unknown;
  /**
   * Debug name shown in Angular DevTools.
   */
  debugName?: string;
  /**
   * Raw code expression for HttpResourceOptions.injector.
   * Example: `inject(Injector)`.
   */
  injector?: string;
  /**
   * Raw code expression for HttpResourceOptions.equal.
   * Example: `(a, b) => a.id === b.id`.
   */
  equal?: string;
}
