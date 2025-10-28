import type { Options } from 'tsdown';

export const baseOptions: Options = {
  entry: ['src/index.ts'],
  target: 'node22.18',
  format: 'esm',
  tsconfig: 'tsconfig.build.json',
  dts: {
    sourcemap: true,
  },
};
