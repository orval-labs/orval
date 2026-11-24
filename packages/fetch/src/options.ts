import type {
  Mutator,
  NormalizedRuntimeValidation,
  RuntimeValidation,
} from '@orval/core';

export interface NormalizedFetchOptions {
  asyncInferredMutator?: boolean;
  includeHttpResponseReturnType: boolean;
  forceSuccessResponse: boolean;
  includeHttpErrorResponse?: boolean;
  serializeResponseHeaders: boolean;
  jsonReviver?: Mutator;
  runtimeValidation: NormalizedRuntimeValidation;
  useRuntimeFetcher: boolean;
  httpClientInjection?: 'factory';
  /**
   * Serialization format for array query parameters that do not have an explicit
   * `explode` setting in the OpenAPI spec.
   *
   * - `repeat` — repeat the key for each value: `foo=1&foo=2`
   * - `brackets` — append `[]` to the key: `foo[]=1&foo[]=2`
   * - `comma` — join values with a comma: `foo=1,2`
   */
  arrayFormat?: 'repeat' | 'brackets' | 'comma';
  runtimeImplementationStyle: FetchRuntimeImplementationStyle;
  runtimeOutputPath: string;
  clientConfigOutputPath: string;
}

export type FetchRuntimeImplementationStyle = 'inline' | 'shared';

export interface FetchOptions {
  /** Make inferred Promise-returning mutator operations async. @default false */
  asyncInferredMutator?: boolean;
  includeHttpResponseReturnType?: boolean;
  forceSuccessResponse?: boolean;
  /**
   * Pass full error response types to a custom mutator's ErrorType and declared
   * error statuses/media types in its third argument. Requires response envelopes,
   * forceSuccessResponse, and a non-hook mutator accepting three arguments.
   * Only explicit error status codes are supported after content-type filtering.
   *
   * @default false
   */
  includeHttpErrorResponse?: boolean;
  /**
   * Return response `headers` as a plain `Record<string, string>` instead of a
   * `Headers` instance, so the response stays serializable. Keys are lowercased
   * and `set-cookie` is omitted. With a `mutator` this only changes the declared
   * type — the mutator must return headers in that shape itself.
   *
   * @default false
   */
  serializeResponseHeaders?: boolean;
  jsonReviver?: Mutator;
  runtimeValidation?: RuntimeValidation;
  useRuntimeFetcher?: boolean;
  /**
   * When `'factory'`, wraps all generated functions inside a factory closure
   * that accepts a `fetch` implementation once, instead of passing it per-call.
   * Applies to `client: 'fetch'` only, and is read from `output.override.fetch`.
   *
   * @default undefined (top-level functions, fetchFn passed per-call)
   */
  httpClientInjection?: 'factory';
  /**
   * Serialization format for array query parameters that do not have an explicit
   * `explode` setting in the OpenAPI spec.
   *
   * - `repeat` — repeat the key for each value: `foo=1&foo=2`
   * - `brackets` — append `[]` to the key: `foo[]=1&foo[]=2`
   * - `comma` — join values with a comma: `foo=1,2`
   */
  arrayFormat?: 'repeat' | 'brackets' | 'comma';
  /**
   * `'shared'` generates the execution logic once into a shared runtime and
   * turns every operation into a thin wrapper. Read from `output.override.fetch` only.
   *
   * @default 'inline'
   */
  runtimeImplementationStyle?: FetchRuntimeImplementationStyle;
  /** @default `runtime.ts` next to the target */
  runtimeOutputPath?: string;
  /** Emitted only with a global `mutator`. @default `client-config.ts` next to the target */
  clientConfigOutputPath?: string;
}
