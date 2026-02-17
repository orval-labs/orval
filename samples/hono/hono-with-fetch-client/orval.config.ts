import { defineConfig } from 'orval';

export default defineConfig({
  petstoreClient: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'fetch',
      target: 'next-app/app/gen/',
      schemas: 'next-app/app/gen/models',
      clean: true,
      prettier: true,
      baseUrl: 'http://localhost:8787',
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
      target: 'hono-app/src/petstore.ts',
      prettier: true,
      override: {
        hono: {
          handlers: 'hono-app/src/handlers',
        },
      },
    },
  },
});
