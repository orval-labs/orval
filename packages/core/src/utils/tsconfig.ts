import { Tsconfig } from '../types';

export const isSyntheticDefaultImportsAllow = (config?: Tsconfig) => {
  if (!config) {
    return true;
  }

  return !!(
    config?.compilerOptions?.allowSyntheticDefaultImports ??
    config?.compilerOptions?.esModuleInterop
  );
};
