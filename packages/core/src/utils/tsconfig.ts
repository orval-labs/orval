import type { Tsconfig } from '../types.ts';

export const isSyntheticDefaultImportsAllow = (config?: Tsconfig) => {
  if (!config) {
    return true;
  }

  return !!(
    config?.compilerOptions?.allowSyntheticDefaultImports ??
    config?.compilerOptions?.esModuleInterop
  );
};
