import { defineConfig } from 'orval';

export default defineConfig({
  petstore: {
    output: {
      mode: 'split',
      target: 'src/petstore.ts',
      client: 'hono',
      override: {
        hono: {
          handlers: 'src/handlers',
        },
      },
    },
    input: {
      target: './petstore.yaml',
    },
  },
});
