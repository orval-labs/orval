import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    projects: ['packages/*/vitest.config.ts'],
  },
});
