import fs from 'node:fs/promises';

import {
  escapePath,
  getConfiguredMockDirectories,
  getFileInfo,
  isString,
  log,
  logWarning,
  type NormalizedOptions,
  OutputMockType,
  removeFilesAndEmptyFolders,
  upath,
} from '@orval/core';

import { importSpecs } from './import-specs';
import { writeSpecs } from './write-specs';

/**
 * Source extensions that a mock file can carry. `output.fileExtension` selects
 * one of them, but a run after a change of that option must still find the
 * files that the previous extension left behind.
 */
const MOCK_FILE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.mts',
  '.cts',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
];

/** An absolute POSIX path, so paths from different options compare equal. */
const toComparablePath = (directory: string): string =>
  upath.resolve(directory);

/**
 * Tells whether `child` names a directory below `parent`. The comparison is
 * per path segment, so `src/api/mocks-extra` is not below `src/api/mocks`.
 */
const isBelow = (parent: string, child: string): boolean => {
  const parentSegments = parent.split('/');
  const childSegments = child.split('/');

  return (
    childSegments.length > parentSegments.length &&
    parentSegments.every((segment, index) => segment === childSegments[index])
  );
};

/** The path of `child` relative to `parent`. Requires `isBelow(parent, child)`. */
const relativeToParent = (parent: string, child: string): string =>
  child.split('/').slice(parent.split('/').length).join('/');

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

    // `target` and `schemas` are Orval's own directories, so they are emptied.
    // A configured mock directory can hold hand-written code, so only Orval's
    // own mock files are removed there. A mock directory below an owned one
    // keeps that protection: the wipe skips it and the prune cleans it.
    const ownedDirectories = new Set<string>();

    if (options.output.target) {
      ownedDirectories.add(
        toComparablePath(getFileInfo(options.output.target).dirname),
      );
    }
    if (options.output.schemas) {
      // `schemas` names a directory and the writers join onto it directly.
      // `getFileInfo(...).dirname` would give the parent of that directory
      // whenever the last segment contains a dot.
      ownedDirectories.add(
        toComparablePath(
          isString(options.output.schemas)
            ? options.output.schemas
            : options.output.schemas.path,
        ),
      );
    }

    const mockDirectories = getConfiguredMockDirectories(
      options.output.mock,
    ).map(toComparablePath);

    for (const directory of ownedDirectories) {
      // The relative path is embedded in a glob pattern below, so a mock
      // directory name that itself carries glob metacharacters (e.g.
      // `mocks[legacy]`) must be escaped. Otherwise the negation pattern
      // does not match the literal directory and the wipe below can delete
      // hand-written files inside it.
      const nestedMockPatterns = mockDirectories
        .filter((mockDirectory) => isBelow(directory, mockDirectory))
        .map(
          (mockDirectory) =>
            `!${escapePath(relativeToParent(directory, mockDirectory))}/**`,
        );

      await removeFilesAndEmptyFolders(
        ['**/*', '!**/*.d.ts', ...extraPatterns, ...nestedMockPatterns],
        directory,
      );
    }

    // `OutputMockType` gives the name segment that the writers interpolate
    // (`<name>.<type><extension>`), so the patterns cannot drift from what is
    // emitted. `extraPatterns` is left out on purpose: a positive glob there
    // would reach hand-written files that Orval never wrote.
    const mockPatterns = Object.values(OutputMockType).flatMap((type) =>
      [...new Set([options.output.fileExtension, ...MOCK_FILE_EXTENSIONS])].map(
        (extension) => `**/*.${type}${extension}`,
      ),
    );

    for (const directory of mockDirectories) {
      // An owned directory of the same path is emptied above.
      if (ownedDirectories.has(directory)) continue;

      // `followSymbolicLinks: false` only keeps the glob from following a
      // symlink found *below* `directory` — it does not validate `directory`
      // itself. If the configured mock path is a symlink, it would still be
      // used as the glob's cwd, and cleanup would follow it straight through
      // to files outside the workspace. lstat (not stat, so the link itself
      // is inspected rather than its target) and skip it.
      let mockRootStats;
      try {
        mockRootStats = await fs.lstat(directory);
      } catch {
        continue; // Nothing to clean if the directory doesn't exist yet.
      }
      if (mockRootStats.isSymbolicLink()) {
        logWarning(
          `${projectName ? `${projectName} ` : ''}Skipped cleaning "${directory}": the configured mock path is a symbolic link.`,
        );
        continue;
      }

      await removeFilesAndEmptyFolders(mockPatterns, directory, {
        followSymbolicLinks: false,
      });
    }

    log(`${projectName} Cleaning output folder`);
  }

  const writeSpecBuilder = await importSpecs(workspace, options, projectName);
  await writeSpecs(writeSpecBuilder, workspace, options, projectName);
}
