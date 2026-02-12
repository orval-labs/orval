import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/api-generation.spec.ts'],
  },
});
