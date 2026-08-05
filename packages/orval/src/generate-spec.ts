import {
  getFileInfo,
  getMockDir,
  isString,
  log,
  type NormalizedOptions,
  OutputMockType,
  removeFilesAndEmptyFolders,
} from '@orval/core';

import { importSpecs } from './import-specs';
import { writeSpecs } from './write-specs';

/**
 * Collects the directories mock files are written to.
 *
 * @remarks
 * Resolved through {@link getMockDir}, the same helper the mode writers use to
 * decide where to *write* mock files, so cleaning cannot target a different
 * directory than generation does. `mock.path` is included even when no
 * generator resolves to it, so removing the last generator from a
 * configuration still prunes what earlier runs left there.
 *
 * The paths are used as configured rather than through
 * `getFileInfo(...).dirname`, which collapses to the parent directory when the
 * last segment contains a dot (#3624).
 *
 * @returns The configured mock output directories, possibly empty.
 */
function getConfiguredMockDirectories(
  mock: NormalizedOptions['output']['mock'],
): string[] {
  const directories = new Set<string>();

  if (mock.path) {
    directories.add(mock.path);
  }
  for (const generator of mock.generators) {
    const directory = getMockDir(generator, mock);
    if (directory) {
      directories.add(directory);
    }
  }

  return [...directories];
}

/**
 * Globs matching the mock files Orval writes into a configured mock directory.
 *
 * @remarks
 * Derived from {@link OutputMockType}, whose values are exactly what the mode
 * writers interpolate when naming mock files (`<name>.<type><extension>`), so
 * the patterns cannot drift from what is emitted and a new mock type is
 * covered by adding it to that enum. Every type is matched in every configured
 * mock directory rather than only the types currently configured for it —
 * dropping a generator from a configuration is one of the ways a directory
 * acquires orphans in the first place.
 *
 * @param fileExtension - The configured output file extension.
 */
function getMockCleanPatterns(fileExtension: string): string[] {
  return Object.values(OutputMockType).map(
    (type) => `**/*.${type}${fileExtension}`,
  );
}

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

    // Directories the documentation declares Orval's own and tells users to
    // keep hand-written files out of. Only these are emptied wholesale.
    const ownedDirectories = new Set<string>();

    if (options.output.target) {
      ownedDirectories.add(getFileInfo(options.output.target).dirname);
    }
    if (options.output.schemas) {
      // Used as configured: `schemas` names a directory and the writers join
      // onto it directly, so passing it through `getFileInfo(...).dirname`
      // would clean the parent of the directory generation actually fills
      // whenever the last segment contains a dot (#3624).
      ownedDirectories.add(
        isString(options.output.schemas)
          ? options.output.schemas
          : options.output.schemas.path,
      );
    }

    for (const directory of ownedDirectories) {
      await removeFilesAndEmptyFolders(
        ['**/*', '!**/*.d.ts', ...extraPatterns],
        directory,
      );
    }

    // A configured mock directory carries no such promise — the documented
    // example points it inside the application source tree — so it is pruned
    // of Orval's own output instead of emptied. `extraPatterns` is deliberately
    // not applied: a positive glob there would reach hand-written files in a
    // directory Orval does not own.
    const mockPatterns = getMockCleanPatterns(options.output.fileExtension);
    for (const directory of getConfiguredMockDirectories(options.output.mock)) {
      if (ownedDirectories.has(directory)) continue;
      await removeFilesAndEmptyFolders(mockPatterns, directory);
    }

    log(`${projectName} Cleaning output folder`);
  }

  const writeSpecBuilder = await importSpecs(workspace, options, projectName);
  await writeSpecs(writeSpecBuilder, workspace, options, projectName);
}
