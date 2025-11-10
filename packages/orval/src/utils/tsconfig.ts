import { isNullish, isObject, isString, type Tsconfig } from '@orval/core';
import { findUp } from 'find-up';
import fs from 'fs-extra';
import { parse } from 'tsconfck';

import { normalizePath } from './options.ts';

export const loadTsconfig = async (
  tsconfig?: Tsconfig | string,
  workspace = process.cwd(),
): Promise<Tsconfig | undefined> => {
  if (isNullish(tsconfig)) {
    const configPath = await findUp(['tsconfig.json', 'jsconfig.json'], {
      cwd: workspace,
    });
    if (configPath) {
      const config = await parse(configPath);
      return config.tsconfig as Tsconfig;
    }
    return;
  }

  if (isString(tsconfig)) {
    const normalizedPath = normalizePath(tsconfig, workspace);
    if (fs.existsSync(normalizedPath)) {
      const config = await parse(normalizedPath);

      const tsconfig = (config.referenced?.find(
        ({ tsconfigFile }) => tsconfigFile === normalizedPath,
      )?.tsconfig ?? config.tsconfig) as Tsconfig;

      return tsconfig;
    }
    return;
  }

  if (isObject(tsconfig)) {
    return tsconfig;
  }
  return;
};
