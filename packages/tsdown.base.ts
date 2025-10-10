import type { UserConfig } from 'tsdown';

export const baseOptions: UserConfig = {
  entry: ['src/index.ts'],
  target: 'node18',
  format: 'cjs',
  tsconfig: 'tsconfig.build.json',
  sourcemap: true,
};
