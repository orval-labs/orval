import basepath from 'node:path';

import {
  type ClientMockBuilder,
  type FakerMockOptions,
  type GlobalMockOptions,
  OutputMockType,
  type WriteModeProps,
} from '../types';
import { isFunction, pascal, SOURCE_FILE_EXTENSIONS, upath } from '../utils';

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

/** Name of a tag's MSW handler list, which the mock index re-exports. */
export const getMockHandlersName = (
  tag: string,
  mockHandlersName: string | undefined,
) => mockHandlersName ?? `get${pascal(tag)}Mock`;

/**
 * Throws when two tags would get the same MSW handler list name. The mock
 * index re-exports each list by name and a repeated named export does not
 * compile, so writers call this before they write any tag file.
 */
export function assertUniqueMockHandlerNames(
  handlerNamesByTag: ReadonlyMap<string, string>,
): void {
  const tagsByName = new Map<string, string>();
  const sorted = [...handlerNamesByTag].toSorted(([a], [b]) =>
    a.localeCompare(b),
  );
  for (const [tag, name] of sorted) {
    const otherTag = tagsByName.get(name);
    if (otherTag !== undefined) {
      throw new Error(
        `The MSW mock index would export '${name}' for both tag '${otherTag}' and tag '${tag}'. ` +
          'Give each tag a distinct handler name, for example with `override.title`.',
      );
    }
    tagsByName.set(name, tag);
  }
}
