export { defineConfig, defineTransformer } from './utils/options';
export type { Options } from '@orval/core';
export * from '@orval/core';
export type { ZodParamsContext } from '@orval/zod';

// Preserve the public `generate` exports without making config-only imports
// pay for the generator, parser, and writer dependency graph upfront.
export const generate = (
  ...args: Parameters<typeof import('./generate').generate>
) => import('./generate').then(({ generate }) => generate(...args));

export default generate;
