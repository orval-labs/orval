import { Options } from 'tsup';

export const baseOptions = {
  entry: ['src/index.ts'],
  target: 'node18',
  sourcemap: true,
  clean: true,
} satisfies Options;
