import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    // The smart/full strategies lazy-load the TypeScript compiler via
    // `await import('typescript')`. The first test to trigger that pays the
    // cold module-load cost, which can exceed vitest's 5s default on a cold
    // cache / CI. Give these tests headroom.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
