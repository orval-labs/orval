import { dirname } from 'upath';
import { importSpecs } from './core/importers/specs';
import { writeSpecs } from './core/writers/specs';
import { ConfigExternal, NormalizedOptions } from './types';
import { catchError } from './utils/errors';
import { loadFile } from './utils/file';
import { isFunction } from './utils/is';
import { normalizeOptions } from './utils/options';

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

export const generateConfig = async (
  configFile?: string,
  projectName?: string,
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

  if (projectName) {
    const optionsExport = config[projectName];
    const normalizedOptions = await normalizeOptions(optionsExport);

    if (normalizedOptions) {
      generateSpec(workspace, normalizedOptions, projectName);
    } else {
      catchError('Project not found');
    }
    return;
  }

  return Promise.all(
    Object.entries(config).map(async ([projectName, optionsExport]) => {
      const normalizedOptions = await normalizeOptions(optionsExport);

      return generateSpec(workspace, normalizedOptions, projectName);
    }),
  );
};
