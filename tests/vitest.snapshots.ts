import { defineConfig } from 'vite-plus';

import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  test: {
    silent: 'passed-only',
    projects: [
      {
        extends: true,
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
            'fixtures-runtime.spec.ts',
          ],
        },
      },
      // Node resolves `solid-js` to its server build, which has no reactivity,
      // so the generated solid-query hooks run against the client build here.
      {
        extends: true,
        resolve: { conditions: ['browser', 'development'] },
        ssr: { resolve: { conditions: ['browser', 'development'] } },
        test: {
          name: { label: `${pkg.name}:solid` },
          include: ['solid-query-reactivity.spec.ts'],
          server: {
            deps: { inline: [/solid-js/, /@tanstack\/solid-query/] },
          },
        },
      },
    ],
  },
});
