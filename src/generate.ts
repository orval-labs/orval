import chalk from 'chalk';
import { dirname } from 'upath';
import { importSpecs } from './core/importers/specs';
import { writeSpecs } from './core/writers/specs';
import {
  ConfigExternal,
  GlobalOptions,
  NormalizedOptions,
  NormizaledConfig,
} from './types';
import { asyncReduce } from './utils/async-reduce';
import { catchError } from './utils/errors';
import { getFileInfo, loadFile, removeFiles } from './utils/file';
import { isFunction, isString } from './utils/is';
import { log } from './utils/messages/logs';
import { normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';

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
      await removeFiles(
        ['**/*', '!**/*.d.ts', ...extraPatterns],
        getFileInfo(options.output.target).dirname,
      );
    }
    if (options.output.schemas) {
      await removeFiles(
        ['**/*', '!**/*.d.ts', ...extraPatterns],
        getFileInfo(options.output.schemas).dirname,
      );
    }
    log(`${projectName ? `${projectName}: ` : ''}Cleaning output folder`);
  }

  const writeSpecProps = await importSpecs(workspace, options);
  await writeSpecs(writeSpecProps, workspace, options, projectName);
};

export const generateSpecs = async (
  config: NormizaledConfig,
  workspace: string,
  projectName?: string,
) => {
  if (projectName) {
    const options = config[projectName];

    if (options) {
      try {
        await generateSpec(workspace, options, projectName);
      } catch (e) {
        log(chalk.red(`🛑  ${projectName ? `${projectName} - ` : ''}${e}`));
      }
    } else {
      catchError('Project not found');
    }
    return;
  }

  return Promise.all(
    Object.entries(config).map(async ([projectName, options]) => {
      try {
        return await generateSpec(workspace, options, projectName);
      } catch (e) {
        log(chalk.red(`🛑  ${projectName ? `${projectName} - ` : ''}${e}`));
      }
    }),
  );
};

export const generateConfig = async (
  configFile?: string,
  options?: GlobalOptions,
) => {
  const { path, file: configExternal } = await loadFile<ConfigExternal>(
    configFile,
    {
      defaultFileName: 'orval.config',
    },
  );

  const workspace = dirname(path);

  const config = await (isFunction(configExternal)
    ? configExternal()
    : configExternal);

  const normalizedConfig = await asyncReduce(
    Object.entries(config),
    async (acc, [key, value]) => ({
      ...acc,
      [key]: await normalizeOptions(value, workspace, options),
    }),
    {} as NormizaledConfig,
  );

  const fileToWatch = Object.entries(normalizedConfig)
    .filter(
      ([project]) =>
        options?.projectName === undefined || project === options?.projectName,
    )
    .map(([, { input }]) => input.target)
    .filter((target) => isString(target)) as string[];

  if (options?.watch && fileToWatch.length) {
    startWatcher(
      options?.watch,
      () => generateSpecs(normalizedConfig, workspace, options?.projectName),
      fileToWatch,
    );
  } else {
    await generateSpecs(normalizedConfig, workspace, options?.projectName);
  }
};
