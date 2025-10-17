import type { UserConfig } from 'tsdown';

export const baseOptions: UserConfig = {
  entry: ['src/index.ts'],
  target: 'node22.18',
  format: 'cjs',
  tsconfig: 'tsconfig.build.json',
  sourcemap: true,
};
