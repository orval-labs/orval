import {
  getFileInfo,
  isString,
  log,
  type NormalizedOptions,
  removeFilesAndEmptyFolders,
} from '@orval/core';

import { importSpecs } from './import-specs';
import { writeSpecs } from './write-specs';

/**
 * Generate client/spec files for a single Orval project.
 *
 * @param workspace - Absolute or relative workspace path used to resolve imports.
 * @param options - Normalized generation options for this project.
 * @param projectName - Optional project name used in logging output.
 * @returns A promise that resolves once generation (and optional cleaning) completes.
 *
 * @example
 * await generateSpec(process.cwd(), normalizedOptions, 'my-project');
 */
export async function generateSpec(
  workspace: string,
  options: NormalizedOptions,
  projectName?: string,
) {
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
      const schemasPath = isString(options.output.schemas)
        ? options.output.schemas
        : options.output.schemas.path;
      await removeFilesAndEmptyFolders(
        ['**/*', '!**/*.d.ts', ...extraPatterns],
        getFileInfo(schemasPath).dirname,
      );
    }
    log(`${projectName} Cleaning output folder`);
  }

  const writeSpecBuilder = await importSpecs(workspace, options, projectName);
  await writeSpecs(writeSpecBuilder, workspace, options, projectName);
}
