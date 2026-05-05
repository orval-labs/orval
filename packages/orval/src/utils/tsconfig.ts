import { isNullish, isObject, isString, type Tsconfig } from '@orval/core';
import { findUp } from 'find-up';
import fs from 'fs-extra';
import {
  parseTsconfig,
  type TsConfigJson,
  type TsConfigJsonResolved,
} from 'get-tsconfig';

import { normalizePath } from './options';

type LowercaseString<T extends string> = T extends `${infer First}${infer Rest}`
  ? `${Lowercase<First>}${LowercaseString<Rest>}`
  : T;

const convertTarget = (config: TsConfigJsonResolved): Tsconfig => {
  if (!config.compilerOptions?.target) {
    return {
      baseUrl: config.compilerOptions?.baseUrl,
      ...config,
    } as Tsconfig;
  }
  const lowercaseTarget =
    config.compilerOptions.target.toLowerCase() as LowercaseString<TsConfigJson.CompilerOptions.Target>;
  return {
    baseUrl: config.compilerOptions?.baseUrl,
    ...config,
    compilerOptions: { ...config.compilerOptions, target: lowercaseTarget },
  };
};

export const loadTsconfig = async (
  tsconfig?: Tsconfig | string,
  workspace = process.cwd(),
): Promise<Tsconfig | undefined> => {
  if (isNullish(tsconfig)) {
    const configPath = await findUp(['tsconfig.json', 'jsconfig.json'], {
      cwd: workspace,
    });
    if (configPath) {
      const config = parseTsconfig(configPath);
      return convertTarget(config);
    }
    return;
  }

  if (isString(tsconfig)) {
    const normalizedPath = normalizePath(tsconfig, workspace);
    if (fs.existsSync(normalizedPath)) {
      const config = parseTsconfig(normalizedPath);
      return convertTarget(config);
    }
    return;
  }

  if (isObject(tsconfig)) {
    return tsconfig;
  }
  return;
};
