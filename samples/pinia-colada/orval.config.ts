import { defineConfig } from 'orval';

export default defineConfig({
  ...Object.fromEntries(
    (['fetch', 'axios'] as const).flatMap((httpClient) =>
      (['single', 'split', 'tags', 'tags-split'] as const).map((mode) => [
        `${httpClient}-${mode}`,
        {
          input: './openapi.json',
          output: {
            target: `src/gen/${httpClient}-${mode}/client.ts`,
            schemas: `src/gen/${httpClient}-${mode}/models`,
            client: 'pinia-colada',
            httpClient,
            mode,
            baseUrl: '/api',
            override: { fetch: { includeHttpResponseReturnType: false } },
          },
        },
      ]),
    ),
  ),
  custom: {
    input: './openapi.json',
    output: {
      target: 'src/gen/custom/client.ts',
      client: 'pinia-colada',
      httpClient: 'fetch',
      baseUrl: '/api',
      override: {
        mutator: { path: './src/custom-fetch.ts', name: 'customFetch' },
      },
    },
  },
});
