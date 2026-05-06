import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['src/index.ts'],
  target: 'node22',
  platform: 'node',
  format: 'esm',
  tsconfig: 'tsconfig.build.json',
  dts: { sourcemap: true },
  exports: { devExports: 'development' },
});
