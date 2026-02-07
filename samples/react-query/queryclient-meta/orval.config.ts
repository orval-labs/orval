import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'split',
      target: 'src/api/endpoints/petstore.ts',
      schemas: 'src/api/model',
      client: 'react-query',
      httpClient: 'axios',
      httpClientInjection: 'reactQueryMeta',
      prettier: true,
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
