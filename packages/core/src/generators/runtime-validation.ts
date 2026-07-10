import type {
  NormalizedRuntimeValidation,
  RuntimeValidation,
  RuntimeValidationStrategy,
} from '../types';

/**
 * The syntactic shape a validation snippet has to take at the call site it is
 * spliced into. Each generator emits validation at one of these four shapes:
 *
 * - `rxjs-map`: a trailing `.pipe(map(...))` operator chained onto an observable
 *   (Angular `HttpClient`, `angular-query`). The mapped value is named `data`.
 * - `clone-expression`: a value expression injected into a larger expression
 *   such as `response.clone({ body: <here> })`. Multi-statement `both` bodies
 *   are IIFE-wrapped so they stay expressions.
 * - `fetch-assign`: a value expression assigned to `const data = <here>` inside
 *   the generated `fetch` function. Also IIFE-wrapped for `both`.
 * - `parse-fn`: the value of Angular `httpResource`'s native `parse:` option —
 *   `throw` emits a bare `Schema.parse` reference, `both` an arrow function.
 */
export type RuntimeValidationEmitContext =
  | 'rxjs-map'
  | 'clone-expression'
  | 'fetch-assign'
  | 'parse-fn';

export interface EmitResponseValidationOptions {
  /** Reference to the Zod schema value, e.g. `PetsSchema`. */
  schemaRef: string;
  /** Operation name, surfaced in the `both` strategy's `console.error` message. */
  operationName: string;
  strategy: RuntimeValidationStrategy;
  context: RuntimeValidationEmitContext;
  /**
   * Source expression to validate. Required for `clone-expression` and
   * `fetch-assign`; ignored for `rxjs-map` (always `data`) and `parse-fn`
   * (always the arrow's `raw` parameter).
   */
  inputExpression?: string;
}

/**
 * Builds the statement body shared by every `both` emission: `safeParse`, log
 * the raw `ZodError` for production visibility, then re-throw so the failure
 * still propagates through the client's native error channel.
 *
 * The raw `ZodError` is passed to `console.error` (no `prettifyError`/`flatten`)
 * to stay agnostic across Zod 3 and Zod 4.
 *
 * `operationName` is interpolated into a single-quoted string literal. The
 * default is a sanitized camelCase identifier, but `override.operationName` can
 * return arbitrary strings, so backslashes and single quotes are escaped to
 * keep the generated literal syntactically valid. Sanitized identifiers contain
 * neither character, so common output is unchanged.
 */
const escapeSingleQuoted = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

const buildGuardBody = (
  schemaRef: string,
  operationName: string,
  input: string,
): string =>
  `const result = ${schemaRef}.safeParse(${input}); ` +
  `if (!result.success) { ` +
  `console.error('[orval] ${escapeSingleQuoted(operationName)} response validation failed', result.error); ` +
  `throw result.error; ` +
  `} ` +
  `return result.data;`;

/**
 * Emits the response-validation snippet for a single call site.
 *
 * The `throw` strategy is byte-identical to the historical inline
 * `Schema.parse(...)` emission, which keeps existing snapshots unchanged.
 */
export const emitResponseValidation = ({
  schemaRef,
  operationName,
  strategy,
  context,
  inputExpression,
}: EmitResponseValidationOptions): string => {
  switch (context) {
    case 'rxjs-map':
      return strategy === 'both'
        ? `.pipe(map(data => { ${buildGuardBody(schemaRef, operationName, 'data')} }))`
        : `.pipe(map(data => ${schemaRef}.parse(data)))`;

    case 'clone-expression':
    case 'fetch-assign': {
      if (inputExpression === undefined) {
        throw new Error(
          `emitResponseValidation: "${context}" requires an inputExpression`,
        );
      }
      return strategy === 'both'
        ? `(() => { ${buildGuardBody(schemaRef, operationName, inputExpression)} })()`
        : `${schemaRef}.parse(${inputExpression})`;
    }

    case 'parse-fn':
      return strategy === 'both'
        ? `(raw) => { ${buildGuardBody(schemaRef, operationName, 'raw')} }`
        : `${schemaRef}.parse`;
  }
};

/**
 * Normalizes the user-facing `runtimeValidation` config surface
 * (`boolean | { strategy }`) into the canonical `{ enabled, strategy }` object
 * consumed by the generators.
 *
 * Idempotent: an already-normalized value is returned unchanged, so it is safe
 * to call on an inherited (already-normalized) value — e.g. when a per-operation
 * `query` override inherits the normalized global default.
 */
export const normalizeRuntimeValidation = (
  value: RuntimeValidation | NormalizedRuntimeValidation | undefined,
): NormalizedRuntimeValidation => {
  if (!value) {
    return { enabled: false, strategy: 'throw' };
  }
  if (value === true) {
    return { enabled: true, strategy: 'throw' };
  }
  // Already-normalized canonical object — return as-is (idempotent).
  if ('enabled' in value) {
    return value;
  }
  return { enabled: true, strategy: value.strategy ?? 'throw' };
};
