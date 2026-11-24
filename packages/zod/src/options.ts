import type {
  Mutator,
  NormalizedMutator,
  SchemaExtension,
  SchemaSectionFlags,
  UnsupportedSchemaMode,
  operationZodOverrideKeys,
} from '@orval/core';

export interface ZodDateTimeOptions {
  offset?: boolean;
  local?: boolean;
  precision?: number;
}

export interface ZodTimeOptions {
  precision?: -1 | 0 | 1 | 2 | 3;
}

/**
 * Target Zod major version for generated output.
 *
 * - `4` — always emit Zod 4-style output (`z.strictObject`, `z.looseObject`,
 *   `z.iso.datetime()`, `.meta()`, …) regardless of the installed `zod` version.
 * - `3` — always emit Zod 3-compatible output (`.strict()`/`.passthrough()`,
 *   `z.string().datetime()`, …) regardless of the installed `zod` version.
 * - `'auto'` — infer the target from the `zod` version resolved in the output
 *   project's `package.json`; when no `zod` package can be detected, fall back
 *   to Zod 4 output.
 */
export type ZodVersionOption = 3 | 4 | 'auto';

export type ZodVariantOption = 'classic' | 'mini';

interface BaseZodOptions<TVersion extends ZodVersionOption = ZodVersionOption> {
  strict?: Partial<SchemaSectionFlags>;
  generate?: Partial<SchemaSectionFlags>;
  coerce?: {
    param?: boolean | ZodCoerceType[];
    query?: boolean | ZodCoerceType[];
    header?: boolean | ZodCoerceType[];
    body?: boolean | ZodCoerceType[];
    response?: boolean | ZodCoerceType[];
  };
  preprocess?: {
    param?: Mutator;
    query?: Mutator;
    header?: Mutator;
    body?: Mutator;
    response?: Mutator;
  };
  /**
   * Mutator referencing a function called once per emitted validator at schema
   * construction time. It receives codegen-time context (operation, location,
   * schema name, field path, validator name) and returns a Zod `params` object
   * (e.g. `{ error: ... }`) that is appended as the trailing argument.
   *
   * The plural name follows Zod's own term for the validator's second argument
   * (`z.string(params)`) and is unrelated to the singular `param` key used by
   * `generate` / `coerce` / `preprocess` above, which refers to the path-parameter
   * location.
   */
  params?: Mutator;
  useBrandedTypes?: boolean;
  /**
   * When true, each generated `export const X = <zod schema>` is followed by
   * `export type X = zod.input<typeof X>;` and
   * `export type XOutput = zod.output<typeof X>;`, including the `Item`
   * schema split out for a bounded/array body or response. Default `false`.
   */
  generateCompanionTypes?: boolean;

  /** Accepts a list of objects specifying OpenAPI property type and format for which
   * to append additional .refine() callbacks. These .refine() callbacks are generated
   * according to validatorsGenerator, which has access to the entire OpenAPI Spec object for the property.
   * validatorsGenerator may return either a single validator or a list, or null if evaluation indicates that
   * no refinements should be added. */
  schemaExtension?: SchemaExtension<TVersion>;
}

interface ZodOptionsBase<
  TVersion extends ZodVersionOption,
  TDateTime extends ZodDateTimeOptions,
  TTime extends ZodTimeOptions,
> extends BaseZodOptions<TVersion> {
  /**
   * Select the generated Zod API style. `classic` imports from `zod`; `mini`
   * imports from `zod/mini` and emits the functional/check-based Zod Mini API.
   * Zod Mini requires a Zod 4 target.
   */
  variant?: ZodVariantOption;
  /**
   * Pin the Zod output target so generation is deterministic instead of
   * inferred from the installed `zod` version. Defaults to `'auto'`, which
   * infers from the detected package and otherwise falls back to Zod 4 output.
   * See {@link ZodVersionOption}.
   */
  version?: TVersion;
  dateTimeOptions?: TDateTime;
  timeOptions?: TTime;
  generateEachHttpStatus?: boolean;
  /**
   * When true, emits one reusable Zod schema per `#/components/schemas/*` `$ref`
   * (with `namingConvention` applied to the name) and references it everywhere
   * instead of inlining. Default `false`. See `docs/superpowers/specs/2026-05-26-reusable-zod-schemas-design.md`.
   */
  generateReusableSchemas?: boolean;
  /**
   * When true (zod v4 only), attaches registry metadata to generated
   * **component** schemas via `.meta({ id, description?, deprecated? })`: `id` is
   * the schema name, plus `description`/`deprecated` when the OpenAPI schema
   * provides them. On zod v3 (which has no `.meta()`) descriptions still emit
   * via `.describe()`. Default `false`.
   */
  generateMeta?: boolean;
  /**
   * When true, a `oneOf`/`anyOf` that carries an OpenAPI `discriminator` is
   * emitted as `zod.discriminatedUnion(key, [...])` (better per-branch errors)
   * instead of a plain `zod.union([...])`, but only when every branch can be
   * represented as an object — otherwise it safely falls back to a union.
   * Default `false` (opt-in), so existing output is unchanged.
   */
  generateDiscriminatedUnion?: boolean;
  /**
   * When true (Zod 4.2+ only), emits `oneOf` as `zod.xor([...])` instead of
   * `zod.union([...])`, so a value matching more than one branch is rejected.
   * Non-strict object branches strip unknown keys, so a subtype payload also
   * matches its supertype (`oneOf: [Pet, Dog]`) and fails `xor`; enable this
   * only when the `oneOf` branches are disjoint. Kept as `zod.union` on Zod 3,
   * Zod 4.0/4.1, when no `zod` version can be detected, when a branch is
   * coerced, for a `oneOf` with a `discriminator`, and when a branch renders
   * looser than the spec (`{}`,
   * `required`-only branches, or keywords such as `not`/`if` that Orval drops).
   * Default `false` (opt-in), so existing output is unchanged.
   */
  generateXor?: boolean;
  /**
   * What to do when a schema construct is validated more loosely than the
   * spec says. `'warn'` generates it anyway, without a message. `'error'`
   * fails the generation with the schema path. Output-wide. Default `'warn'`.
   */
  unsupported?: UnsupportedSchemaMode;
  /**
   * When true (zod v4 only), emits optional object properties with
   * `.exactOptional()` (classic) / `zod.exactOptional()` (mini) instead of
   * `.optional()`, so consumers with `exactOptionalPropertyTypes` infer
   * `{ x?: T }` rather than `{ x?: T | undefined }`. On zod v3 (which has no
   * `.exactOptional()`) this is a no-op and `.optional()` is emitted. Default
   * `false` (opt-in), so existing output is unchanged.
   */
  exactOptional?: boolean;

  /** Accepts a list of objects specifying OpenAPI property type and format for which
   * to append additional .refine() callbacks. These .refine() callbacks are generated
   * according to validatorsGenerator, which has access to the entire OpenAPI Spec object for the property.
   * validatorsGenerator may return either a single validator or a list. */
  schemaExtension?: SchemaExtension<TVersion>;
}

/**
 * Make version: 3 / 4 a discriminator so schemaExtension options are checked
 * against the selected Zod major. `auto` cannot be resolved at type-check time,
 * so it intentionally accepts either version's options.
 */
export type ZodOptions<
  TDateTime extends ZodDateTimeOptions = ZodDateTimeOptions,
  TTime extends ZodTimeOptions = ZodTimeOptions,
> =
  | (ZodOptionsBase<3, TDateTime, TTime> & { version: 3 })
  | (ZodOptionsBase<4, TDateTime, TTime> & { version: 4 })
  | (ZodOptionsBase<'auto', TDateTime, TTime> & { version?: 'auto' });

/**
 * Per-operation/tag Zod overrides only include settings that are actually
 * merged into the operation-specific generator path. Output-wide target and
 * schema-layout settings belong on `override.zod`, not `override.operations.*`
 * / `override.tags.*`.
 */
export type OperationZodOptions = BaseZodOptions;

export type OperationZodOverrideKey = (typeof operationZodOverrideKeys)[number];

export type ZodCoerceType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'bigint'
  | 'date'
  // Not a real `z.coerce.array()` — opting 'array' into `coerce.<location>`
  // wraps array params in a single→array preprocess so a single repeated-key
  // query value (delivered as a scalar by the server framework) still parses.
  | 'array';

/** Predicate accepted by a Zod `.refine()` call. */
export type RefinementFunction<TValue = never> = (value: TValue) => boolean;

/** Options accepted by the second argument of Zod 3's `.refine()`. */
export type Zod3RefinementParams = {
  message?: string;
  path?: (string | number)[];
  params?: object;
};

/** Zod 3 also permits producing the options from the validated value. */
export type Zod3RefinementOptions<TValue> =
  | string
  | Zod3RefinementParams
  | ((value: TValue) => Zod3RefinementParams);

/** The custom issue handed to Zod 4's `error` callback. */
export interface Zod4RefinementIssue {
  readonly code: 'custom';
  readonly input: unknown;
  readonly path?: Array<string | number>;
  readonly message?: string;
  readonly params?: Record<string, unknown>;
}

/** Options accepted by Zod 4's `.refine()` / `zod.refine()`. */
export type Zod4RefinementOptions<
  TIssue extends Zod4RefinementIssue = Zod4RefinementIssue,
> =
  | string
  | {
      error?:
        | string
        | ((issue: TIssue) => string | { message: string } | undefined | null);
      /** @deprecated Zod 4 prefers `error`. */
      message?: string;
      path?: Array<string | number>;
      abort?: boolean;
      when?: (payload: {
        value: unknown;
        issues: readonly unknown[];
      }) => boolean;
      params?: Record<string, unknown>;
    };

/**
 * Match `.refine()` options to the generated Zod version. When version is
 * `'auto'` (or not supplied), both forms remain available because the installed
 * Zod major is only determined during generation.
 */
export type ZodRefinementOptions<
  TValue = never,
  TVersion extends ZodVersionOption = ZodVersionOption,
  TIssue extends Zod4RefinementIssue = Zod4RefinementIssue,
> = TVersion extends 3
  ? Zod3RefinementOptions<TValue>
  : TVersion extends 4
    ? Zod4RefinementOptions<TIssue>
    : Zod3RefinementOptions<TValue> | Zod4RefinementOptions<TIssue>;

/**
 * Values captured from a refinement's lexical environment. `$imports` contains
 * static ES import declarations to emit in the generated module, rather than
 * values to serialize into a closure. Import names are checked against free
 * identifiers in the callable and callbacks nested inside `options`.
 */
export type RefinementBindings = Readonly<Record<string, unknown>> & {
  readonly $imports?: readonly string[];
};

/**
 * A refinement plus its optional Zod `.refine()` second argument. Both the
 * validator and any functions nested inside `options` can capture values from
 * `bindings`. If no bindings are needed, null is an acceptable value.
 */
export type BoundRefinement<
  TValue = never,
  TVersion extends ZodVersionOption = ZodVersionOption,
  TIssue extends Zod4RefinementIssue = Zod4RefinementIssue,
> = {
  callable: RefinementFunction<TValue>;
  options?: ZodRefinementOptions<TValue, TVersion, TIssue>;
  bindings: RefinementBindings | null;
};

export interface NormalizedZodOptions {
  variant: ZodVariantOption;
  version: ZodVersionOption;
  strict: SchemaSectionFlags;
  generate: SchemaSectionFlags;
  coerce: {
    param: boolean | ZodCoerceType[];
    query: boolean | ZodCoerceType[];
    header: boolean | ZodCoerceType[];
    body: boolean | ZodCoerceType[];
    response: boolean | ZodCoerceType[];
  };
  preprocess?: {
    param?: NormalizedMutator;
    query?: NormalizedMutator;
    header?: NormalizedMutator;
    body?: NormalizedMutator;
    response?: NormalizedMutator;
  };
  schemaExtension?: SchemaExtension;
  params?: NormalizedMutator;
  generateEachHttpStatus: boolean;
  useBrandedTypes: boolean;
  generateReusableSchemas: boolean;
  generateMeta: boolean;
  generateDiscriminatedUnion: boolean;
  generateXor: boolean;
  unsupported: UnsupportedSchemaMode;
  exactOptional: boolean;
  generateCompanionTypes: boolean;
  dateTimeOptions: ZodDateTimeOptions;
  timeOptions: ZodTimeOptions;
}

export type NormalizedOperationZodOptions = Pick<
  NormalizedZodOptions,
  OperationZodOverrideKey
>;
