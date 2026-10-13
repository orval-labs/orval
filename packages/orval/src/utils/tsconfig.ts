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

// The TypeScript sources an import of a JavaScript file can name, e.g. an
// import of `./request.js` resolves to `./request.ts` under NodeNext.
const SOURCE_EXTENSIONS_FOR_JS: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

// Mirrors TypeScript's lookup for a mapped candidate: the TypeScript source
// when it names a JavaScript file (preferred over the JavaScript file, so a
// compiled sibling is not inspected instead), the path as written, then with
// each source extension, then as a directory index.
const resolveCandidate = (candidate: string): string | undefined => {
  const jsExtension = path.extname(candidate);
  const stem = candidate.slice(0, -jsExtension.length);
  for (const ext of SOURCE_EXTENSIONS_FOR_JS[jsExtension] ?? []) {
    if (isFile(`${stem}${ext}`)) {
      return `${stem}${ext}`;
    }
  }

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

  // `Tsconfig` also accepts `baseUrl` at the top level, but the matcher only
  // reads `compilerOptions.baseUrl`.
  const config =
    isNullish(tsconfig) || isString(tsconfig)
      ? parseTsconfig(configPath)
      : ({
          ...tsconfig,
          compilerOptions: {
            baseUrl: tsconfig.baseUrl,
            ...tsconfig.compilerOptions,
          },
        } as TsConfigJsonResolved);

  // The matcher throws on `paths` that TypeScript itself rejects (e.g.
  // non-relative targets without a `baseUrl`). Aliases are optional here, so
  // such a tsconfig must not fail configs that never use one.
  let matcher: ReturnType<typeof createPathsMatcher>;
  try {
    matcher = createPathsMatcher({ path: configPath, config });
  } catch {
    return undefined;
  }
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
