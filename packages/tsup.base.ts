import { Options } from 'tsup';

const tsconfig = 'tsconfig.build.json';
export const baseOptions = {
  entry: ['src/index.ts'],
  target: 'node18',
  tsconfig: tsconfig,
  sourcemap: false,
  clean: true,
  // https://tsup.egoist.dev/#generate-typescript-declaration-maps--d-ts-map
  onSuccess: `tsc --project ${tsconfig} --emitDeclarationOnly --declaration`,
} satisfies Options;
