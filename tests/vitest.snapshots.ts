import { defineConfig } from 'vitest/config';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  test: {
    name: { label: pkg.name },
    include: ['api-generation.spec.ts'],
    silent: 'passed-only',
  },
});
