import fs from 'node:fs';
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  resolve,
} from 'node:path';

import chalk from 'chalk';
import { build, PluginBuild } from 'esbuild';
import glob from 'globby';
import mm from 'micromatch';

import { Tsconfig } from '../types';
import { isDirectory } from './assertion';
import { createDebugger } from './debug';
import { createLogger, LogLevel } from './logger';
import { joinSafe, normalizeSafe } from './path';

export const getFileInfo = (
  target = '',
  {
    backupFilename = 'filename',
    extension = '.ts',
  }: { backupFilename?: string; extension?: string } = {},
) => {
  const isDir = isDirectory(target);
  const path = isDir ? join(target, backupFilename + extension) : target;
  const pathWithoutExtension = path.replace(/\.[^/.]+$/, '');
  const dir = dirname(path);
  const filename = basename(
    path,
    extension.startsWith('.') ? extension : `.${extension}`,
  );

  return {
    path,
    pathWithoutExtension,
    extension,
    isDirectory: isDir,
    dirname: dir,
    filename,
  };
};

const debug = createDebugger('orval:file-load');

const cache = new Map<string, { file?: any; error?: any }>();

export async function loadFile<File = any>(
  filePath?: string,
  options?: {
    root?: string;
    defaultFileName?: string;
    logLevel?: LogLevel;
    isDefault?: boolean;
    alias?: Record<string, string>;
    tsconfig?: Tsconfig;
    load?: boolean;
  },
): Promise<{
  path: string;
  file?: File;
  error?: any;
  cached?: boolean;
}> {
  const {
    root = process.cwd(),
    isDefault = true,
    defaultFileName,
    logLevel,
    alias,
    tsconfig,
    load = true,
  } = options ?? {};
  const start = Date.now();

  let resolvedPath: string | undefined;
  let isTS = false;
  let isMjs = false;

  if (filePath) {
    // explicit path is always resolved from cwd
    resolvedPath = resolve(filePath);
    isTS = filePath.endsWith('.ts');
  } else if (defaultFileName) {
    // implicit file loaded from inline root (if present)
    // otherwise from cwd
    const jsFile = resolve(root, `${defaultFileName}.js`);
    if (fs.existsSync(jsFile)) {
      resolvedPath = jsFile;
    }

    if (!resolvedPath) {
      const mjsFile = resolve(root, `${defaultFileName}.mjs`);
      if (fs.existsSync(mjsFile)) {
        resolvedPath = mjsFile;
        isMjs = true;
      }
    }

    if (!resolvedPath) {
      const cjsFile = resolve(root, `${defaultFileName}.cjs`);
      if (fs.existsSync(cjsFile)) {
        resolvedPath = cjsFile;
      }
    }

    if (!resolvedPath) {
      const tsFile = resolve(root, `${defaultFileName}.ts`);
      if (fs.existsSync(tsFile)) {
        resolvedPath = tsFile;
        isTS = true;
      }
    }
  }

  if (!resolvedPath) {
    if (filePath) {
      createLogger(logLevel).error(chalk.red(`File not found => ${filePath}`));
    } else if (defaultFileName) {
      createLogger(logLevel).error(
        chalk.red(`File not found => ${defaultFileName}.{js,mjs,cjs,ts}`),
      );
    } else {
      createLogger(logLevel).error(chalk.red(`File not found`));
    }
    process.exit(1);
  }

  const normalizeResolvedPath = normalizeSafe(resolvedPath);
  const cachedData = cache.get(resolvedPath);

  if (cachedData) {
    return {
      path: normalizeResolvedPath,
      ...cachedData,
      cached: true,
    };
  }

  try {
    let file: File | undefined;

    if (!file && !isTS && !isMjs) {
      // 1. try to directly require the module (assuming commonjs)
      try {
        // clear cache in case of server restart
        delete require.cache[require.resolve(resolvedPath)];

        file = require(resolvedPath);

        debug(`cjs loaded in ${Date.now() - start}ms`);
      } catch (error) {
        const ignored = new RegExp(
          [
            `Cannot use import statement`,
            `Must use import to load ES Module`,
            // #1635, #2050 some Node 12.x versions don't have esm detection
            // so it throws normal syntax errors when encountering esm syntax
            `Unexpected token`,
            `Unexpected identifier`,
          ].join('|'),
        );
        //@ts-ignore
        if (!ignored.test(error.message)) {
          throw error;
        }
      }
    }

    if (!file) {
      // 2. if we reach here, the file is ts or using es import syntax, or
      // the user has type: "module" in their package.json (#917)
      // transpile es import syntax to require syntax using rollup.
      // lazy require rollup (it's actually in dependencies)
      const { code } = await bundleFile(
        resolvedPath,
        isMjs,
        root || dirname(normalizeResolvedPath),
        alias,
        tsconfig?.compilerOptions,
      );

      file = load
        ? await loadFromBundledFile<File>(resolvedPath, code, isDefault)
        : (code as any);

      debug(`bundled file loaded in ${Date.now() - start}ms`);
    }

    cache.set(resolvedPath, { file });

    return {
      path: normalizeResolvedPath,
      file,
    };
  } catch (error: any) {
    cache.set(resolvedPath, { error });

    return {
      path: normalizeResolvedPath,
      error,
    };
  }
}

async function bundleFile(
  fileName: string,
  mjs = false,
  workspace: string,
  alias?: Record<string, string>,
  compilerOptions?: Tsconfig['compilerOptions'],
): Promise<{ code: string; dependencies: string[] }> {
  const result = await build({
    absWorkingDir: process.cwd(),
    entryPoints: [fileName],
    outfile: 'out.js',
    write: false,
    platform: 'node',
    bundle: true,
    format: mjs ? 'esm' : 'cjs',
    sourcemap: 'inline',
    metafile: true,
    target: compilerOptions?.target || 'es6',
    minify: false,
    minifyIdentifiers: false,
    minifySyntax: false,
    minifyWhitespace: false,
    treeShaking: false,
    keepNames: false,
    plugins: [
      ...(alias || compilerOptions?.paths
        ? [
            {
              name: 'aliasing',
              setup(build: PluginBuild) {
                build.onResolve(
                  { filter: /^[\w@][^:]/ },
                  async ({ path: id }) => {
                    if (alias) {
                      const matchKeys = Object.keys(alias);
                      const match = matchKeys.find(
                        (key) =>
                          id.startsWith(key) || mm.isMatch(id, matchKeys),
                      );

                      if (match) {
                        const find = mm.scan(match);
                        const replacement = mm.scan(alias[match]);

                        const base = resolve(workspace, replacement.base);
                        const newPath = find.base
                          ? id.replace(find.base, base)
                          : joinSafe(base, id);

                        const ext = extname(newPath);

                        const aliased = ext ? newPath : `${newPath}.ts`;

                        if (!fs.existsSync(aliased)) {
                          return;
                        }

                        return {
                          path: aliased,
                        };
                      }
                    }

                    if (compilerOptions?.paths) {
                      const matchKeys = Object.keys(compilerOptions?.paths);
                      const match = matchKeys.find(
                        (key) =>
                          id.startsWith(key) || mm.isMatch(id, matchKeys),
                      );

                      if (match) {
                        const find = mm.scan(match);
                        const replacement = mm.scan(
                          compilerOptions?.paths[match][0],
                        );

                        const base = resolve(workspace, replacement.base);
                        const newPath = find.base
                          ? id.replace(find.base, base)
                          : joinSafe(base, id);

                        const ext = extname(newPath);

                        const aliased = ext ? newPath : `${newPath}.ts`;

                        if (!fs.existsSync(aliased)) {
                          return;
                        }

                        return {
                          path: aliased,
                        };
                      }
                    }
                  },
                );
              },
            },
          ]
        : []),
      {
        name: 'externalize-deps',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const id = args.path;
            if (!id.startsWith('.') && !isAbsolute(id)) {
              return {
                external: true,
              };
            }
          });
        },
      },
      {
        name: 'replace-import-meta',
        setup(build) {
          build.onLoad({ filter: /\.[jt]s$/ }, async (args) => {
            const contents = await fs.promises.readFile(args.path, 'utf8');
            return {
              loader: args.path.endsWith('.ts') ? 'ts' : 'js',
              contents: contents
                .replaceAll(
                  /\bimport\.meta\.url\b/g,
                  JSON.stringify(`file://${args.path}`),
                )
                .replaceAll(
                  /\b__dirname\b/g,
                  JSON.stringify(dirname(args.path)),
                )
                .replaceAll(/\b__filename\b/g, JSON.stringify(args.path)),
            };
          });
        },
      },
    ],
  });
  const { text } = result.outputFiles[0];
  return {
    code: text,
    dependencies: result.metafile ? Object.keys(result.metafile.inputs) : [],
  };
}

interface NodeModuleWithCompile extends NodeModule {
  _compile(code: string, filename: string): any;
}

async function loadFromBundledFile<File = unknown>(
  fileName: string,
  bundledCode: string,
  isDefault: boolean,
): Promise<File> {
  const extension = extname(fileName);
  const defaultLoader = require.extensions[extension]!;
  require.extensions[extension] = (module: NodeModule, filename: string) => {
    if (filename === fileName) {
      (module as NodeModuleWithCompile)._compile(bundledCode, filename);
    } else {
      defaultLoader(module, filename);
    }
  };
  // clear cache in case of server restart
  delete require.cache[require.resolve(fileName)];
  const raw = require(fileName);
  const file = isDefault && raw.__esModule ? raw.default : raw;
  require.extensions[extension] = defaultLoader;
  return file;
}

export async function removeFilesAndEmptyFolders(
  patterns: string[],
  dir: string,
) {
  const files = await glob(patterns, {
    cwd: dir,
    absolute: true,
  });

  // Remove files
  await Promise.all(files.map((file) => fs.promises.unlink(file)));

  // Find and remove empty directories
  const directories = await glob(['**/*'], {
    cwd: dir,
    absolute: true,
    onlyDirectories: true,
  });

  // Sort directories by depth (deepest first) to ensure we can remove nested empty folders
  const sortedDirectories = directories.sort((a, b) => {
    const depthA = a.split('/').length;
    const depthB = b.split('/').length;
    return depthB - depthA;
  });

  // Remove empty directories
  for (const directory of sortedDirectories) {
    try {
      const contents = await fs.promises.readdir(directory);
      if (contents.length === 0) {
        await fs.promises.rmdir(directory);
      }
    } catch {
      // Directory might have been removed already or doesn't exist
      // Continue with next directory
    }
  }
}
