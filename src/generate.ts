import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { importSpecs } from './core/importers/specs';
import { writeSpecs } from './core/writers/specs';
import { ExternalConfigFile, Options } from './types';
import { catchError } from './utils/errors';

export const generateSpec = (
  workspace: string,
  options: Options,
  backend?: string,
) => {
  importSpecs(workspace, options)
    .then(writeSpecs(workspace, options, backend))
    .catch(catchError);
};

export const generateConfig = (
  path: string = './orval.config.js',
  projectName?: string,
) => {
  const fullPath = join(process.cwd(), path);

  if (!existsSync(fullPath)) {
    catchError('Orval config not found');
  }

  // tslint:disable-next-line: no-var-requires
  const config: ExternalConfigFile = require(fullPath);
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

  Object.entries(config).forEach(([backend, options]) => {
    generateSpec(workspace, options, backend);
  });
};
