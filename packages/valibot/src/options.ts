import type { SchemaSectionFlags, UnsupportedSchemaMode } from '@orval/core';

export interface ValibotOptions {
  strict?: Partial<SchemaSectionFlags> | undefined;
  generate?: Partial<SchemaSectionFlags> | undefined;
  /**
   * When true, optional object properties use `v.exactOptional(schema)` so
   * `exactOptionalPropertyTypes` consumers infer `{ x?: T }`. Default `false`.
   */
  exactOptional?: boolean;
  /**
   * Emit one constant per `#/components/schemas/*` entry instead of inlining
   * every `$ref`. Output-wide. Default `false`.
   */
  generateReusableSchemas?: boolean;
  /**
   * What to do when a schema construct is validated more loosely than the
   * spec says. `'warn'` generates it anyway and logs the cases Orval already
   * warns about. `'error'` fails the generation with the schema path.
   * Output-wide. Default `'warn'`.
   */
  unsupported?: UnsupportedSchemaMode;
}

/** `override.valibot` keys that may also be set per operation or tag. */
export type OperationValibotOptions = Omit<
  ValibotOptions,
  'generateReusableSchemas' | 'unsupported'
>;

export interface NormalizedValibotOptions {
  strict: SchemaSectionFlags;
  generate: SchemaSectionFlags;
  exactOptional: boolean;
  generateReusableSchemas: boolean;
  unsupported: UnsupportedSchemaMode;
}
