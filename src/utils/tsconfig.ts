import findUp from 'find-up';
import { existsSync } from 'fs-extra';
import { parse } from 'tsconfck';
import { Tsconfig } from '../types';
import { isObject, isString, isUndefined } from './is';
import { normalizePath } from './options';

export const loadTsconfig = async (
  tsconfig?: Tsconfig | string,
  workspace = process.cwd(),
): Promise<Tsconfig | undefined> => {
  if (isUndefined(tsconfig)) {
    const configPath = await findUp(['tsconfig.json', 'jsconfig.json'], {
      cwd: workspace,
    });
    if (configPath) {
      const config = await parse(configPath);
      return config.tsconfig;
    }
    return;
  }

  if (isString(tsconfig)) {
    const normalizedPath = normalizePath(tsconfig, workspace);
    if (existsSync(normalizedPath)) {
      const config = await parse(normalizedPath);

      const tsconfig =
        config.referenced?.find(
          ({ tsconfigFile }) => tsconfigFile === normalizedPath,
        )?.tsconfig || config.tsconfig;

      return tsconfig;
    }
    return;
  }

  if (isObject(tsconfig)) {
    return tsconfig;
  }
  return;
};

export const isSyntheticDefaultImportsAllow = (config?: Tsconfig) => {
  if (!config) {
    return true;
  }

  return !!(
    config?.compilerOptions?.allowSyntheticDefaultImports ??
    config?.compilerOptions?.esModuleInterop
  );
};
