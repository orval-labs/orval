import { log, logError } from '@orval/core';

export const startWatcher = async (
  watchOptions: boolean | string | (string | boolean)[],
  watchFn: () => Promise<any>,
  defaultTarget: string | string[] = '.',
) => {
  if (!watchOptions) return;
  const { watch } = await import('chokidar');

  const ignored = ['**/{.git,node_modules}/**'];

  const watchPaths =
    typeof watchOptions === 'boolean'
      ? defaultTarget
      : Array.isArray(watchOptions)
        ? watchOptions.filter(
            (path): path is string => typeof path === 'string',
          )
        : watchOptions;

  log(
    `Watching for changes in ${
      Array.isArray(watchPaths)
        ? watchPaths.map((v) => '"' + v + '"').join(' | ')
        : '"' + watchPaths + '"'
    }`,
  );

  const watcher = watch(watchPaths, {
    ignorePermissionErrors: true,
    ignored,
  });
  watcher.on('all', async (type, file) => {
    log(`Change detected: ${type} ${file}`);

    try {
      await watchFn();
    } catch (e) {
      logError(e);
    }
  });
};
