import fs from 'node:fs';
import path from 'node:path';

import { isNullish, isObject, isString, type Tsconfig } from '@orval/core';
import {
  createPathsMatcher,
  parseTsconfig,
  type TsConfigJson,
  type TsConfigJsonResolved,
} from 'get-tsconfig';

import { findUp } from './find-up';
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
    baseUrl: config.compilerOptions.baseUrl,
    ...config,
    compilerOptions: { ...config.compilerOptions, target: lowercaseTarget },
  };
};

const findTsconfigPath = (
  tsconfig: string | undefined,
  workspace: string,
): string | undefined => {
  if (isNullish(tsconfig)) {
    return findUp(['tsconfig.json', 'jsconfig.json'], workspace);
  }

  const normalizedPath = normalizePath(tsconfig, workspace);
  return fs.existsSync(normalizedPath) ? normalizedPath : undefined;
};

export const loadTsconfig = async (
  tsconfig?: Tsconfig | string,
  workspace = process.cwd(),
): Promise<Tsconfig | undefined> => {
  if (isNullish(tsconfig) || isString(tsconfig)) {
    const configPath = findTsconfigPath(tsconfig, workspace);
    return configPath ? convertTarget(parseTsconfig(configPath)) : undefined;
  }

  return isObject(tsconfig) ? tsconfig : undefined;
};

/** Resolves an import specifier to a file through tsconfig `paths`. */
export type TsconfigPathsResolver = (specifier: string) => string | undefined;

const RESOLVABLE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
];

const isFile = (filePath: string) => {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
};

// Mirrors TypeScript's lookup for a mapped candidate: the path as written,
// then with each source extension, then as a directory index.
const resolveCandidate = (candidate: string): string | undefined => {
  if (isFile(candidate)) {
    return candidate;
  }

  for (const ext of RESOLVABLE_EXTENSIONS) {
    if (isFile(`${candidate}${ext}`)) {
      return `${candidate}${ext}`;
    }
  }

  for (const ext of RESOLVABLE_EXTENSIONS) {
    const index = path.join(candidate, `index${ext}`);
    if (isFile(index)) {
      return index;
    }
  }

  return undefined;
};

/**
 * Builds a resolver for the tsconfig `paths` aliases, so a mutator can be
 * given as an alias like `api/request` or `@/api/request` and still be
 * located on disk. Returns `undefined` when the tsconfig declares no `paths`.
 *
 * @see https://github.com/orval-labs/orval/issues/4300
 */
export const createTsconfigPathsResolver = (
  tsconfig?: Tsconfig | string,
  workspace = process.cwd(),
): TsconfigPathsResolver | undefined => {
  // An inline tsconfig object has no file of its own, so its `paths` and
  // `baseUrl` are taken relative to the workspace.
  const configPath =
    isNullish(tsconfig) || isString(tsconfig)
      ? findTsconfigPath(tsconfig, workspace)
      : path.join(workspace, 'tsconfig.json');
  if (!configPath) {
    return undefined;
  }

  const config =
    isNullish(tsconfig) || isString(tsconfig)
      ? parseTsconfig(configPath)
      : (tsconfig as TsConfigJsonResolved);
  const matcher = createPathsMatcher({ path: configPath, config });
  if (!matcher) {
    return undefined;
  }

  return (specifier) => {
    for (const candidate of matcher(specifier)) {
      const resolved = resolveCandidate(path.resolve(candidate));
      if (resolved) {
        return resolved;
      }
    }
    return undefined;
  };
};
