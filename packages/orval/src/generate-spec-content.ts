import path from 'node:path';

import {
  generateImports,
  generateModelsInline,
  isFunction,
  isString,
  isUrl,
  type NormalizedOptions,
  withMutatorSourceCache,
} from '@orval/core';

import { importSpecs } from './import-specs';
import {
  findConfigFile,
  getConfigProjects,
  loadConfigFile,
} from './utils/config';
import { normalizeOptions } from './utils/options';
import { getHeader } from './write-specs';

export interface ProjectForSpec {
  /** The directory of the config file, which relative paths resolve from. */
  workspace: string;
  projectName: string;
  options: NormalizedOptions;
}

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

  const projects = getConfigProjects(
    await loadConfigFile(configFilePath),
  ).filter(([name]) => project === undefined || name === project);
  if (project !== undefined && projects.length === 0) {
    throw new Error(`Project not found in ${configFilePath}: ${project}`);
  }

  const matches: ProjectForSpec[] = [];
  for (const [projectName, optionsExport] of projects) {
    const options = await (isFunction(optionsExport)
      ? optionsExport()
      : optionsExport);
    const target =
      isString(options.input) || Array.isArray(options.input)
        ? options.input
        : options.input?.target;
    const targets = (Array.isArray(target) ? target : [target]).filter(
      isString,
    );
    if (
      !targets.some(
        (entry) => !isUrl(entry) && path.resolve(workspace, entry) === specFile,
      )
    ) {
      continue;
    }

    // An array input is a list of fallbacks, and normalizing picks the first
    // one that exists, so only that one counts as the input.
    const normalizedOptions = await normalizeOptions(options, workspace);
    if (normalizedOptions.input.target === specFile) {
      matches.push({ workspace, projectName, options: normalizedOptions });
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
      `Several projects in ${configFilePath} have ${specPath} as their input: ${matches.map(({ projectName }) => projectName).join(', ')}. Choose one of them by its project name`,
    );
  }

  return matches[0];
}

/**
 * Generate the type definitions of a single Orval project without writing any
 * file.
 *
 * The content holds the models of `components` and the types derived from the
 * operations (parameters, request bodies and responses), after the imports of
 * the types they take from other packages. Client functions, mocks, factory
 * methods and validation schemas are not generated, so the options that place
 * or post-process files (`output.target`, `mode`, `schemas`, `workspace`,
 * `mock`, `clean`, formatter, hooks, docs) have no effect.
 *
 * @param workspace - Absolute or relative workspace path used to resolve imports.
 * @param options - Normalized generation options for this project.
 * @param projectName - Optional project name used in generation.
 * @returns The generated content.
 *
 * @example
 * const content = await generateSpecContent(process.cwd(), normalizedOptions);
 */
export async function generateSpecContent(
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
): Promise<string> {
  // Without `output.target` the API builder takes its schemas-only path: it
  // collects the types derived from the operations but generates no client.
  // The field is typed as a string, and the builder tests it for truthiness.
  const typesOnlyOptions: NormalizedOptions = {
    ...options,
    output: {
      ...options.output,
      target: '',
      schemas: undefined,
      operationSchemas: undefined,
      workspace: undefined,
      mock: { ...options.output.mock, generators: [] },
      factoryMethods: undefined,
      // `const` and `enum` emit runtime values, which a content without a
      // runtime module cannot provide.
      override: { ...options.output.override, enumGenerationType: 'union' },
    },
  };

  return withMutatorSourceCache(async () => {
    const builder = await importSpecs(workspace, typesOnlyOptions, projectName);

    // The models are written together, so only the imports of other packages,
    // such as an `override.formatType` type, are kept.
    const packageImports = builder.schemas
      .flatMap((schema) => schema.imports)
      .filter((imp) => imp.importPath !== undefined);

    return (
      getHeader(typesOnlyOptions.output.override.header, builder.info) +
      generateImports({ imports: packageImports }) +
      (packageImports.length > 0 ? '\n\n' : '') +
      generateModelsInline(builder.schemas)
    );
  });
}
