import basepath from 'node:path';

import type {
  ClientMockBuilder,
  GlobalMockOptions,
  WriteModeProps,
} from '../types';
import { isFunction, upath } from '../utils';

export function getMockDir(
  entry: GlobalMockOptions | ClientMockBuilder,
  mockConfig: WriteModeProps['output']['mock'],
): string | undefined {
  if (!isFunction(entry) && entry.path) {
    return entry.path;
  }
  return mockConfig.path;
}

export function hasAnyMockPath(
  mockConfig: WriteModeProps['output']['mock'],
): boolean {
  if (mockConfig.path) return true;
  return mockConfig.generators.some((g) => !isFunction(g) && !!g.path);
}

/**
 * Lists the directories that mock files are written to.
 *
 * The paths come from {@link getMockDir}, the helper the mode writers use to
 * decide where to write. `mockConfig.path` is listed even when no generator
 * resolves to it, so a configuration that lost its last generator still knows
 * where earlier runs wrote.
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

  return [...directories];
}

export function resolveMockSchemasPath(
  mockFilePath: string,
  schemasTarget: string,
): string {
  // `upath.getRelativeImportPath` strips `basepath.extname`, which would
  // treat a trailing `.schemas` on `schemasTarget` (e.g. the implicit
  // `<filename>.schemas` path used when `output.schemas` is unset) as a
  // file extension and drop it. Treat `.schemas` as a logical marker
  // (not a real extension) and always end up with a real source-file
  // extension on the target.
  const ext = basepath.extname(mockFilePath);
  const targetExt = basepath.extname(schemasTarget);
  const targetWithExt =
    targetExt === '.schemas'
      ? schemasTarget + ext
      : targetExt
        ? schemasTarget
        : schemasTarget + ext;
  return upath.getRelativeImportPath(mockFilePath, targetWithExt);
}
