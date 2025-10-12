import fs from 'node:fs';
import path from 'node:path';

import chalk from 'chalk';
import { build, type PluginBuild } from 'esbuild';
import glob from 'globby';
import mm from 'micromatch';

import type { Tsconfig } from '../types';
import { isDirectory } from './assertion';
import { createDebugger } from './debug';
import { joinSafe, normalizeSafe } from './path';

export const getFileInfo = (
  target = '',
  {
    backupFilename = 'filename',
    extension = '.ts',
  }: { backupFilename?: string; extension?: string } = {},
) => {
  const isDir = isDirectory(target);
  const filePath = isDir
    ? path.join(target, backupFilename + extension)
    : target;
  const pathWithoutExtension = filePath.replace(/\.[^/.]+$/, '');
  const dir = path.dirname(filePath);
  const filename = path.basename(
    filePath,
    extension.startsWith('.') ? extension : `.${extension}`,
  );

  return {
    path: filePath,
    pathWithoutExtension,
    extension,
    isDirectory: isDir,
    dirname: dir,
    filename,
  };
};

const debug = createDebugger('orval:file-load');

const cache = new Map<string, { file?: string; error?: unknown }>();

export async function loadFile(
  filePath?: string,
  options?: {
    root?: string;
    defaultFileName?: string;
    alias?: Record<string, string>;
    tsconfig?: Tsconfig;
  },
): Promise<{
  path: string;
  file?: string;
  error?: unknown;
  cached?: boolean;
}> {
  const {
    root = process.cwd(),
    defaultFileName,
    alias,
    tsconfig,
  } = options ?? {};
  const start = Date.now();

  let resolvedPath: string | undefined;
  let isMjs = false;

  if (filePath) {
    // explicit path is always resolved from cwd
    resolvedPath = path.resolve(filePath);
  } else if (defaultFileName) {
    // implicit file loaded from inline root (if present)
    // otherwise from cwd
    const jsFile = path.resolve(root, `${defaultFileName}.js`);
    if (fs.existsSync(jsFile)) {
      resolvedPath = jsFile;
    }

    if (!resolvedPath) {
      const mjsFile = path.resolve(root, `${defaultFileName}.mjs`);
      if (fs.existsSync(mjsFile)) {
        resolvedPath = mjsFile;
        isMjs = true;
      }
    }

    if (!resolvedPath) {
      const cjsFile = path.resolve(root, `${defaultFileName}.cjs`);
      if (fs.existsSync(cjsFile)) {
        resolvedPath = cjsFile;
      }
    }

    if (!resolvedPath) {
      const tsFile = path.resolve(root, `${defaultFileName}.ts`);
      if (fs.existsSync(tsFile)) {
        resolvedPath = tsFile;
      }
    }
  }

  if (!resolvedPath) {
    if (filePath) {
      throw new Error(chalk.red(`File not found => ${filePath}`));
    } else if (defaultFileName) {
      throw new Error(
        chalk.red(`File not found => ${defaultFileName}.{js,mjs,cjs,ts}`),
      );
    } else {
      throw new Error(chalk.red(`File not found`));
    }
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
    const { code: file } = await bundleFile(
      resolvedPath,
      isMjs,
      root || path.dirname(normalizeResolvedPath),
      alias,
      tsconfig?.compilerOptions,
    );

    debug(`bundled file loaded in ${Date.now() - start}ms`);

    cache.set(resolvedPath, { file });

    return {
      path: normalizeResolvedPath,
      file,
    };
  } catch (error) {
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

                        const base = path.resolve(workspace, replacement.base);
                        const newPath = find.base
                          ? id.replace(find.base, base)
                          : joinSafe(base, id);

                        const ext = path.extname(newPath);

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

                        const base = path.resolve(workspace, replacement.base);
                        const newPath = find.base
                          ? id.replace(find.base, base)
                          : joinSafe(base, id);

                        const ext = path.extname(newPath);

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
            if (!id.startsWith('.') && !path.isAbsolute(id)) {
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
                  JSON.stringify(path.dirname(args.path)),
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
