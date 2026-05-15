import type { Tsconfig } from '../types';

export function isSyntheticDefaultImportsAllow(config?: Tsconfig) {
  if (!config) {
    return true;
  }

  return !!(
    config.compilerOptions?.allowSyntheticDefaultImports ??
    config.compilerOptions?.esModuleInterop
  );
}

const NODE_NEXT_MODULES = new Set(['nodenext', 'node16']);

const NODE_NEXT_EXTENSION_MAP: readonly (readonly [string, string])[] = [
  ['.tsx', '.jsx'],
  ['.mts', '.mjs'],
  ['.cts', '.cjs'],
  ['.ts', '.js'],
];

export function getImportExtension(
  fileExtension: string,
  tsconfig?: Tsconfig,
): string {
  const compilerOptions = tsconfig?.compilerOptions;

  if (compilerOptions?.allowImportingTsExtensions) {
    return fileExtension;
  }

  const module = compilerOptions?.module?.toLowerCase();
  const moduleResolution = compilerOptions?.moduleResolution?.toLowerCase();
  if (
    (module && NODE_NEXT_MODULES.has(module)) ||
    (moduleResolution && NODE_NEXT_MODULES.has(moduleResolution))
  ) {
    for (const [from, to] of NODE_NEXT_EXTENSION_MAP) {
      if (fileExtension.endsWith(from)) {
        return `${fileExtension.slice(0, -from.length)}${to}`;
      }
    }
    return fileExtension;
  }

  return fileExtension.replace(/\.ts$/, '') || '';
}
