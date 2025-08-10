import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/bin/orval.ts', 'src/index.ts'],
  target: 'node20',
  sourcemap: false,
  clean: true,
  // https://tsup.egoist.dev/#generate-typescript-declaration-maps--d-ts-map
  onSuccess: 'tsc --emitDeclarationOnly --declaration',
});
