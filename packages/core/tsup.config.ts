import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node20',
  sourcemap: false,
  clean: true,
  onSuccess: 'tsc --emitDeclarationOnly --declaration',
});
