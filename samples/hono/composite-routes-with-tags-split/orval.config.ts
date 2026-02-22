import { defineConfig } from 'orval';

export default defineConfig({
  api: {
    input: {
      target: './petstore.yaml',
    },
    output: {
      mode: 'tags-split',
      client: 'hono',
      target: 'src/endpoints',
      schemas: 'src/schemas',
      prettier: true,
      override: {
        hono: {
          compositeRoute: 'src/routes.ts',
          validatorOutputPath: 'src/endpoints/validator.ts',
        },
      },
    },
  },
});
