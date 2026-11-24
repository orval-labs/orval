import type { SchemaSectionFlags } from '@orval/core';

/**
 * Target Effect major version for generated output.
 *
 * - `4` — always emit Effect 4 Schema output (`S.Union([...])`, `.check(...)`,
 *   `S.optionalKey`, …) regardless of the installed `effect` version.
 * - `3` — always emit Effect 3 Schema output (`S.Union(...)`, `.pipe(...)`,
 *   `S.optionalWith`, …) regardless of the installed `effect` version.
 * - `'auto'` — infer the target from the `effect` version resolved in the
 *   output project's `package.json`; when no `effect` package can be detected,
 *   fall back to Effect 4 output.
 */
export type EffectVersionOption = 3 | 4 | 'auto';

export interface EffectOptions {
  strict?: Partial<SchemaSectionFlags> | undefined;
  generate?: Partial<SchemaSectionFlags> | undefined;
  generateEachHttpStatus?: boolean;
  useBrandedTypes?: boolean;
  /**
   * When true, emits optional Struct properties with
   * `S.optionalWith(schema, { exact: true })` (Effect 3) or
   * `S.optionalKey(schema)` (Effect 4) instead of `S.optional(schema)`, so
   * `exactOptionalPropertyTypes` consumers infer `{ x?: T }`. Default `false`.
   */
  exactOptional?: boolean;
  /**
   * Pin the Effect output target instead of inferring it from the installed
   * `effect` version. Defaults to `'auto'`. See {@link EffectVersionOption}.
   */
  version?: EffectVersionOption;
  /**
   * Emit one constant per component schema an operation reaches instead of
   * inlining every `$ref`. Output-wide. Default `false`.
   */
  generateReusableSchemas?: boolean;
}

/** `override.effect` keys that may also be set per operation or tag. */
export type OperationEffectOptions = Omit<
  EffectOptions,
  'generateReusableSchemas'
>;

export interface NormalizedEffectOptions {
  strict: SchemaSectionFlags;
  generate: SchemaSectionFlags;
  generateEachHttpStatus: boolean;
  useBrandedTypes: boolean;
  exactOptional: boolean;
  version: EffectVersionOption;
  generateReusableSchemas: boolean;
}
