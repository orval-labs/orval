import { dirname } from 'upath';
import { importSpecs } from './core/importers/specs';
import { writeSpecs } from './core/writers/specs';
import { ConfigExternal, NormalizedOptions, NormizaledConfig } from './types';
import { asyncReduce } from './utils/async-reduce';
import { catchError } from './utils/errors';
import { loadFile } from './utils/file';
import { isFunction, isString } from './utils/is';
import { normalizeOptions } from './utils/options';
import { startWatcher } from './utils/watcher';

export const generateSpec = async (
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
) => {
  try {
    const writeSpecProps = await importSpecs(workspace, options);
    await writeSpecs(writeSpecProps, workspace, options, projectName);
  } catch (e) {
    catchError(e);
  }
};

export const generateSpecs = async (
  config: NormizaledConfig,
  workspace: string,
  projectName?: string,
) => {
  if (projectName) {
    const options = config[projectName];

    if (options) {
      generateSpec(workspace, options, projectName);
    } else {
      catchError('Project not found');
    }
    return;
  }

  return Promise.all(
    Object.entries(config).map(async ([projectName, options]) => {
      return generateSpec(workspace, options, projectName);
    }),
  );
};

export const generateConfig = async (
  configFile?: string,
  projectName?: string,
  watch?: boolean | string | (string | boolean)[],
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

  const normizaliedConfig = await asyncReduce(
    Object.entries(config),
    async (acc, [key, value]) => ({
      ...acc,
      [key]: await normalizeOptions(value, workspace),
    }),
    {} as NormizaledConfig,
  );

  if (watch) {
    startWatcher(
      watch,
      () => generateSpecs(normizaliedConfig, workspace, projectName),
      Object.values(normizaliedConfig)
        .map(({ input }) => input.target)
        .filter((target) => isString(target)) as string[],
    );
  } else {
    generateSpecs(normizaliedConfig, workspace, projectName);
  }
};
