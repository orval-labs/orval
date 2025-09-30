import { faker } from '@faker-js/faker';
import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      baseUrl: 'http://localhost:8000',
      mode: 'split',
      target: 'src/api/endpoints',
      schemas: 'src/api/models',
      client: 'swr',
      httpClient: 'fetch',
      mock: true,
      override: {
        fetch: {
          includeHttpResponseReturnType: false,
        },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
