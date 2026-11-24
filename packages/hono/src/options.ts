/**
 * Strategy controlling how an existing hono handler file is treated on
 * regeneration.
 *
 * - `smart` (default): non-destructively reconcile orval-owned imports and
 *   `zValidator` arguments and append handlers for new operations, preserving
 *   all user-authored imports, middleware, bodies, and top-level code.
 * - `skip`: leave an existing handler file byte-for-byte unchanged.
 * - `full`: rebuild the preamble and validator chain from the spec, splicing
 *   back only the handler body. Drops custom imports/middleware/helpers.
 */
export type HonoHandlerStrategy = 'smart' | 'skip' | 'full';

export interface NormalizedHonoOptions {
  handlers?: string;
  handlerGenerationStrategy: HonoHandlerStrategy;
  compositeRoute: string;
  validator: boolean | 'hono';
  validatorOutputPath: string;
}

export interface HonoOptions {
  handlers?: string;
  handlerGenerationStrategy?: HonoHandlerStrategy;
  compositeRoute?: string;
  validator?: boolean | 'hono';
  validatorOutputPath?: string;
}
