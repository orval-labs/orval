import { pathExists } from 'fs-extra';
import { dirname, resolve } from 'upath';
import { importSpecs } from './core/importers/specs';
import { writeSpecs } from './core/writers/specs';
import { ExternalConfigFile, Options } from './types';
import { catchError } from './utils/errors';
import { dynamicImport } from './utils/imports';

export const generateSpec = async (
  workspace: string,
  options: Options,
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
  path: string = './orval.config.js',
  projectName?: string,
) => {
  const fullPath = resolve(process.cwd(), path);

  if (!(await pathExists(fullPath))) {
    catchError('orval config not found');
  }

  const config = await dynamicImport<ExternalConfigFile>(fullPath);

  const workspace = dirname(fullPath);

  if (projectName) {
    const project = config[projectName];

    if (project) {
      generateSpec(workspace, project, projectName);
    } else {
      catchError('Project not found');
    }
    return;
  }

  return Promise.all(
    Object.entries(config).map(([projectName, options]) =>
      generateSpec(workspace, options, projectName),
    ),
  );
};
