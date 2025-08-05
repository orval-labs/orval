import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin/orval.ts', 'src/index.ts'],
  target: 'node20',
  sourcemap: true,
  clean: true,
});
