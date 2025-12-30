import fs from 'node:fs';
import path from 'node:path';

import { type Config, type ConfigExternal, isFunction } from '@orval/core';
import { createJiti } from 'jiti';

/**
 * Resolve the Orval config file path.
 *
 * @param configFilePath - Optional path to the config file (absolute or relative).
 * @returns The absolute path to the resolved config file.
 * @throws If a provided path does not exist or if no config file is found.
 *
 * @example
 * // explicit path
 * const p = findConfigFile('./orval.config.ts');
 *
 * @example
 * // automatic discovery (searches process.cwd())
 * const p = findConfigFile();
 */
export function findConfigFile(configFilePath?: string) {
  if (configFilePath) {
    const absolutePath = path.isAbsolute(configFilePath)
      ? configFilePath
      : path.resolve(process.cwd(), configFilePath);

    if (!fs.existsSync(absolutePath))
      throw new Error(`Config file ${configFilePath} does not exist`);

    return absolutePath;
  }

  const root = process.cwd();
  const exts = ['.ts', '.js', '.mjs', '.mts'];
  for (const ext of exts) {
    const fullPath = path.resolve(root, `orval.config${ext}`);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  throw new Error(`No config file found in ${root}`);
}

/**
 * Load an Orval config file
 * @param configFilePath - Path to the config file (absolute or relative).
 * @returns The resolved Orval `Config` object.
 * @throws If the module does not provide a default export or the default export resolves to `undefined`.
 *
 * @example
 * // load a config object
 * const cfg = await loadConfigFile('./orval.config.ts');
 */
export async function loadConfigFile(configFilePath: string): Promise<Config> {
  const jiti = createJiti(process.cwd(), {
    interopDefault: true,
  });

  const configExternal = await jiti.import<ConfigExternal | undefined>(
    configFilePath,
    {
      default: true,
    },
  );

  if (configExternal === undefined) {
    throw new Error(`${configFilePath} doesn't have a default export`);
  }

  const config = await (isFunction(configExternal)
    ? configExternal()
    : configExternal);

  return config;
}
