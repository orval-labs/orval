import type { UserConfig } from 'tsdown';

export const baseOptions: UserConfig = {
  entry: ['src/index.ts'],
  target: 'node22.18',
  format: 'esm',
  tsconfig: 'tsconfig.build.json',
  dts: {
    sourcemap: true,
  },
};
