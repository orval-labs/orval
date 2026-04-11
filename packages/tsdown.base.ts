import type { UserConfig } from 'tsdown';

export const baseConfig: UserConfig = {
  entry: ['src/index.ts'],
  target: 'node22.18',
  platform: 'node',
  format: 'esm',
  tsconfig: 'tsconfig.build.json',
  dts: {
    sourcemap: true,
  },
  exports: true,
};
