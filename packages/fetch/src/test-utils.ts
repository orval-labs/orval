import { typeCheck } from '../../core/src/test-utils/typescript';

/** `lib.es2022.d.ts` → `es2022`, the form `tsconfig.json` expects. */
const toLibName = (fileName: string) =>
  fileName.replace(/^lib\./, '').replace(/\.d\.ts$/, '');

export function typeCheckFiles(
  files: Record<string, string>,
  lib = ['lib.es2022.d.ts'],
) {
  return typeCheck(files, {
    compilerOptions: {
      strict: true,
      exactOptionalPropertyTypes: true,
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'Bundler',
      lib: lib.map(toLibName),
      types: [],
    },
  });
}
