import { defineConfig } from 'orval';

export default defineConfig({
  basic: {
    output: {
      target: '../generated/zod',
      client: 'zod',
    },
    input: {
      target: '../specifications/circular.yaml',
    },
  },
});
