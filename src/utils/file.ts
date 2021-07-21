import chalk from 'chalk';
import { build } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { basename, dirname, join, normalizeSafe } from 'upath';
import { createDebugger } from './debug';
import { isDirectory } from './is';
import { lookupFile } from './lookup-file';
import { createLogger, LogLevel } from './messages/logs';

export const getFileInfo = (
  target: string = '',
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
    extension[0] !== '.' ? `.${extension}` : extension,
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

export async function loadFile<File = unknown>(
  filePath?: string,
  options?: {
    root?: string;
    defaultFileName?: string;
    logLevel?: LogLevel;
    isDefault?: boolean;
  },
): Promise<{
  path: string;
  file: File;
  dependencies: string[];
}> {
  const { root = process.cwd(), isDefault = true, defaultFileName, logLevel } =
    options || {};
  const start = Date.now();

  let resolvedPath: string | undefined;
  let isTS = false;
  let isMjs = false;
  let dependencies: string[] = [];

  if (filePath) {
    // explicit path is always resolved from cwd
    resolvedPath = path.resolve(filePath);
    isTS = filePath.endsWith('.ts');
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
      const tsFile = path.resolve(root, `${defaultFileName}.ts`);
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
        chalk.red(`File not found => ${defaultFileName}.{js,mjs,ts}`),
      );
    } else {
      createLogger(logLevel).error(chalk.red(`File not found`));
    }
    process.exit(1);
  }

  try {
    let file: File | undefined;

    if (isMjs) {
      const fileUrl = require('url').pathToFileURL(resolvedPath);
      if (isTS) {
        // before we can register loaders without requiring users to run node
        // with --experimental-loader themselves, we have to do a hack here:
        // bundle the file w/ ts transforms first, write it to disk,
        // load it with native Node ESM, then delete the file.
        const bundled = await bundleFile(resolvedPath, true);
        dependencies = bundled.dependencies;
        fs.writeFileSync(resolvedPath + '.js', bundled.code);
        file = (await eval(`import(fileUrl + '.js?t=${Date.now()}')`)).default;
        fs.unlinkSync(resolvedPath + '.js');
        debug(`TS + native esm loaded in ${Date.now() - start}ms`, fileUrl);
      } else {
        // using eval to avoid this from being compiled away by TS/Rollup
        // append a query so that we force reload fresh config in case of
        // server restart
        file = (await eval(`import(fileUrl + '?t=${Date.now()}')`)).default;
        debug(`native esm loaded in ${Date.now() - start}ms`, fileUrl);
      }
    }

    if (!file && !isTS && !isMjs) {
      // 1. try to directly require the module (assuming commonjs)
      try {
        // clear cache in case of server restart
        delete require.cache[require.resolve(resolvedPath)];
        file = require(resolvedPath);
        debug(`cjs loaded in ${Date.now() - start}ms`);
      } catch (e) {
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
        if (!ignored.test(e.message)) {
          throw e;
        }
      }
    }

    if (!file) {
      // 2. if we reach here, the file is ts or using es import syntax, or
      // the user has type: "module" in their package.json (#917)
      // transpile es import syntax to require syntax using rollup.
      // lazy require rollup (it's actually in dependencies)
      const bundled = await bundleFile(resolvedPath);
      dependencies = bundled.dependencies;
      file = await loadFromBundledFile<File>(
        resolvedPath,
        bundled.code,
        isDefault,
      );
      debug(`bundled file loaded in ${Date.now() - start}ms`);
    }

    return {
      path: normalizeSafe(resolvedPath),
      file,
      dependencies,
    };
  } catch (e) {
    createLogger(logLevel).error(
      chalk.red(`failed to load from ${resolvedPath}`),
    );
    throw e;
  }
}

async function bundleFile(
  fileName: string,
  mjs = false,
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
    plugins: [
      {
        name: 'externalize-deps',
        setup(build) {
          build.onResolve({ filter: /.*/ }, (args) => {
            const id = args.path;
            if (id[0] !== '.' && !path.isAbsolute(id)) {
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
                .replace(
                  /\bimport\.meta\.url\b/g,
                  JSON.stringify(`file://${args.path}`),
                )
                .replace(
                  /\b__dirname\b/g,
                  JSON.stringify(path.dirname(args.path)),
                )
                .replace(/\b__filename\b/g, JSON.stringify(args.path)),
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
  const extension = path.extname(fileName);
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
