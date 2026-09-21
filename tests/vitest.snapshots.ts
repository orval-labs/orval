import { defineConfig } from 'vite-plus';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  test: {
    name: { label: pkg.name },
    include: [
      'api-generation.spec.ts',
      'handler-preservation.spec.ts',
      'query-key-mutator.spec.ts',
      'serialize-response-headers.spec.ts',
      'axios-url-runtime.spec.ts',
      'angular-zod-array-validation.spec.ts',
      'fetch-zod-array-validation.spec.ts',
      'query-swr-zod-validation.spec.ts',
      'dates-transform-request.spec.ts',
      'dates-transform-fetch.spec.ts',
      'mutation-invalidates-options-mutator.spec.ts',
    ],
    silent: 'passed-only',
  },
});
