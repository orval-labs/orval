import path from 'node:path';

import {
  isFunction,
  isString,
  isUrl,
  type NormalizedOptions,
  type Options,
} from '@orval/core';

import { findConfigFile, getConfigProjects, loadConfigFile } from './config';
import { normalizeOptions } from './options';

export interface ProjectForSpec {
  /** The directory of the config file, which relative paths resolve from. */
  workspace: string;
  projectName: string;
  options: NormalizedOptions;
}

/**
 * The spec file that a project reads, as an absolute path. A URL, an inline
 * document or several merged specs are not a single file.
 */
const getSpecFile = (
  { input }: Options,
  workspace: string,
): string | undefined => {
  const target =
    isString(input) || Array.isArray(input) ? input : input?.target;
  return isString(target) && !isUrl(target)
    ? path.resolve(workspace, target)
    : undefined;
};

/**
 * Load the project of an Orval config whose input is `specPath`.
 *
 * @param specPath - The spec file, relative to the current directory.
 * @param config - The config file. Defaults to `orval.config.*` in the current directory.
 * @param project - The project to use when several read `specPath`.
 * @throws When no project, or more than one without `project`, reads `specPath`.
 */
export async function loadProjectForSpec(
  specPath: string,
  { config, project }: { config?: string; project?: string } = {},
): Promise<ProjectForSpec> {
  const configFilePath = findConfigFile(config);
  const workspace = path.dirname(configFilePath);
  const specFile = path.resolve(specPath);

  const projects = getConfigProjects(await loadConfigFile(configFilePath));

  if (project !== undefined && !projects.some(([name]) => name === project)) {
    throw new Error(`Project not found in ${configFilePath}: ${project}`);
  }

  const matches: [string, Options][] = [];
  for (const [name, optionsExport] of projects) {
    if (project !== undefined && name !== project) continue;

    const options = await (isFunction(optionsExport)
      ? optionsExport()
      : optionsExport);
    if (getSpecFile(options, workspace) === specFile) {
      matches.push([name, options]);
    }
  }

  if (matches.length === 0) {
    throw new Error(
      project === undefined
        ? `No project in ${configFilePath} has ${specPath} as its input`
        : `Project ${project} in ${configFilePath} does not have ${specPath} as its input`,
    );
  }
  if (matches.length > 1) {
    throw new Error(
      `Several projects in ${configFilePath} have ${specPath} as their input: ${matches.map(([name]) => name).join(', ')}. Choose one of them by its project name`,
    );
  }

  const [[projectName, options]] = matches;
  return {
    workspace,
    projectName,
    options: await normalizeOptions(options, workspace),
  };
}
