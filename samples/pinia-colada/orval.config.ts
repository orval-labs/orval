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
  ...Object.fromEntries(
    (['fetch', 'axios'] as const).flatMap((httpClient) =>
      (['named', 'no-options', 'required-options'] as const).map((variant) => [
        `${httpClient}-${variant}`,
        {
          input: './openapi.json',
          output: {
            target: `src/gen/${httpClient}-${variant}/client.ts`,
            client: 'pinia-colada',
            httpClient,
            optionsParamRequired: variant === 'required-options',
            override: {
              useNamedParameters: variant === 'named',
              requestOptions: variant !== 'no-options',
              fetch: { includeHttpResponseReturnType: false },
            },
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
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
  customAxios: {
    input: './openapi.json',
    output: {
      target: 'src/gen/custom-axios/client.ts',
      client: 'pinia-colada',
      httpClient: 'axios',
      baseUrl: '/api',
      override: {
        mutator: { path: './src/custom-axios.ts', name: 'customAxios' },
      },
    },
  },
});
