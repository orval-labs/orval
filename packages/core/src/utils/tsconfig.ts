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
    return fileExtension.endsWith('.ts')
      ? `${fileExtension.slice(0, -3)}.js`
      : fileExtension;
  }

  return fileExtension.replace(/\.ts$/, '') || '';
}
