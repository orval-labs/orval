import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node20',
  sourcemap: true,
  clean: true,
});
