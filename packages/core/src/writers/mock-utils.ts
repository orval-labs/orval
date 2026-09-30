import basepath from 'node:path';

import {
  type ClientMockBuilder,
  type FakerMockOptions,
  type GlobalMockOptions,
  OutputMockType,
  type WriteModeProps,
} from '../types';
import { isFunction, SOURCE_FILE_EXTENSIONS, upath } from '../utils';

export function getMockDir(
  entry: GlobalMockOptions | ClientMockBuilder,
  mockConfig: WriteModeProps['output']['mock'],
): string | undefined {
  if (!isFunction(entry) && entry.path) {
    return entry.path;
  }
  return mockConfig.path;
}

/** The faker generator entry, when one is configured. */
export function getFakerEntry(
  mockConfig: WriteModeProps['output']['mock'],
): FakerMockOptions | undefined {
  return mockConfig.generators.find(
    (g): g is FakerMockOptions =>
      !isFunction(g) && g.type === OutputMockType.FAKER,
  );
}

/**
 * Lists the directories that mock files are written to.
 *
 * The paths come from {@link getMockDir}, the helper the mode writers use to
 * decide where to write. `mockConfig.path` is listed even when no generator
 * resolves to it, so a configuration that lost its last generator still knows
 * where earlier runs wrote.
 *
 * The faker generator's `schemasPath` is listed as well, since the schema
 * factories file is a mock file.
 *
 * @returns The configured mock output directories. Empty when no mock path is
 * configured, in which case mock files land beside the implementation files.
 */
export function getConfiguredMockDirectories(
  mockConfig: WriteModeProps['output']['mock'],
): string[] {
  const directories = new Set<string>();

  if (mockConfig.path) {
    directories.add(mockConfig.path);
  }
  for (const generator of mockConfig.generators) {
    const directory = getMockDir(generator, mockConfig);
    if (directory) {
      directories.add(directory);
    }
  }
  // The faker generator's `schemasPath` holds a mock file too, and can sit
  // outside every other output directory.
  const schemasPath = getFakerEntry(mockConfig)?.schemasPath;
  if (schemasPath) {
    directories.add(schemasPath);
  }

  return [...directories];
}

export function resolveMockSchemasPath(
  mockFilePath: string,
  schemasTarget: string,
): string {
  // `upath.getRelativeImportPath` strips `basepath.extname`, which would
  // treat any dotted tail on `schemasTarget` as a file extension and drop
  // it: the `.schemas` marker of the implicit `<filename>.schemas` file used
  // when `output.schemas` is unset, or the custom part of a
  // `schemaFileExtension` such as `.types.ts` (`<filename>.schemas.types`,
  // #4234). Only strip a real source-file extension; keep everything else.
  const targetExt = basepath.extname(schemasTarget);
  return upath.getRelativeImportPath(
    mockFilePath,
    schemasTarget,
    !SOURCE_FILE_EXTENSIONS.has(targetExt),
  );
}
