import { defineConfig } from 'orval';

export default defineConfig({
  basic: {
    output: {
      target: '../generated/zod',
      client: 'zod',
      override: {
        coerceTypes: true,
      },
    },
    input: {
      target: '../specifications/parameters.yaml',
    },
  },
});
