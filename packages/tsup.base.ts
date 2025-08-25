import { Options } from 'tsup';

export const baseOptions = {
  entry: ['src/index.ts'],
  target: 'node18',
  sourcemap: false,
  clean: true,
  // https://tsup.egoist.dev/#generate-typescript-declaration-maps--d-ts-map
  onSuccess: 'tsc --emitDeclarationOnly --declaration',
} satisfies Options;
