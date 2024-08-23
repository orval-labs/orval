import { defineConfig } from 'orval';

export default defineConfig({
  petstoreClient: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'fetch',
      target: 'app/gen/clients',
      schemas: 'app/gen/models',
      clean: true,
      baseUrl: 'http://localhost:8000',
      mock: true,
    },
  },
  petstoreApi: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'split',
      client: 'hono',
      target: 'app/api/[...route]/route.ts',
      override: {
        hono: {
          handlers: 'app/api/[...route]/handlers',
        },
      },
    },
  },
});
