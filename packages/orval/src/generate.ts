import {
  asyncReduce,
  type ConfigExternal,
  ErrorWithTag,
  getFileInfo,
  type GlobalOptions,
  isFunction,
  isString,
  loadFile,
  log,
  logError,
  type NormalizedConfig,
  type NormalizedOptions,
  removeFilesAndEmptyFolders,
  upath,
} from '@orval/core';

import { importSpecs } from './import-specs';
import { normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';
import { writeSpecs } from './write-specs';

export const generateSpec = async (
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
) => {
  if (options.output.clean) {
    const extraPatterns = Array.isArray(options.output.clean)
      ? options.output.clean
      : [];

    if (options.output.target) {
      await removeFilesAndEmptyFolders(
        ['**/*', '!**/*.d.ts', ...extraPatterns],
        getFileInfo(options.output.target).dirname,
      );
    }
    if (options.output.schemas) {
      await removeFilesAndEmptyFolders(
        ['**/*', '!**/*.d.ts', ...extraPatterns],
        getFileInfo(options.output.schemas).dirname,
      );
    }
    log(`${projectName ? `${projectName}: ` : ''}Cleaning output folder`);
  }

  const writeSpecBuilder = await importSpecs(workspace, options);
  await writeSpecs(writeSpecBuilder, workspace, options, projectName);
};

export const generateSpecs = async (
  config: NormalizedConfig,
  workspace: string,
  projectName?: string,
) => {
  if (projectName) {
    const options = config[projectName];

    if (options) {
      try {
        await generateSpec(workspace, options, projectName);
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'unknown error';
        throw new ErrorWithTag(errorMsg, projectName, { cause: error });
      }
    } else {
      throw new Error('Project not found');
    }
    return;
  }

  let hasErrors: true | undefined;
  for (const [projectName, options] of Object.entries(config)) {
    if (!options) {
      hasErrors = true;
      logError('No options found', projectName);
      continue;
    }
    try {
      await generateSpec(workspace, options, projectName);
    } catch (error) {
      hasErrors = true;
      logError(error, projectName);
    }
  }

  if (hasErrors)
    throw new Error('One or more project failed, see above for details');
};

export const generateConfig = async (
  configFile?: string,
  options?: GlobalOptions,
) => {
  const {
    path,
    file: configExternal,
    error,
  } = await loadFile<ConfigExternal>(configFile, {
    defaultFileName: 'orval.config',
  });

  if (!configExternal) {
    throw new Error(`failed to load from ${path} => ${error}`);
  }

  const workspace = upath.dirname(path);

  const config = await (isFunction(configExternal)
    ? configExternal()
    : configExternal);

  const normalizedConfig = await asyncReduce(
    Object.entries(config),
    async (acc, [key, value]) => {
      acc[key] = await normalizeOptions(value, workspace, options);

      return acc;
    },
    {} as NormalizedConfig,
  );

  const fileToWatch = Object.entries(normalizedConfig)
    .filter(
      ([project]) =>
        options?.projectName === undefined || project === options.projectName,
    )
    .map(([, options]) => options?.input.target)
    .filter((target) => isString(target)) as string[];

  await (options?.watch && fileToWatch.length > 0
    ? startWatcher(
        options.watch,
        () => generateSpecs(normalizedConfig, workspace, options.projectName),
        fileToWatch,
      )
    : generateSpecs(normalizedConfig, workspace, options?.projectName));
};
