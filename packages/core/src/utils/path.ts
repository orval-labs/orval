import basepath from 'node:path';

import { getExtension } from './extension';

export function toUnix(value: string): string {
  value = value.replaceAll('\\', '/');
  value = value.replaceAll(/(?<!^)\/+/g, '/'); // deduplicate except leading for UNC paths
  return value;
}

export function join(...args: string[]): string {
  return toUnix(basepath.join(...args.map((a) => toUnix(a))));
}

/**
 * Behaves exactly like `path.relative(from, to)`, but keeps the first meaningful "./"
 */
export function relativeSafe(from: string, to: string) {
  const normalizedRelativePath = toUnix(
    basepath.relative(toUnix(from), toUnix(to)),
  );
  const relativePath = normalizeSafe(`.${separator}${normalizedRelativePath}`);
  return relativePath;
}

export function getSchemaFileName(path: string) {
  return path
    .replace(`.${getExtension(path)}`, '')
    .slice(path.lastIndexOf('/') + 1);
}

export const separator = '/';

export function normalizeSafe(value: string) {
  let result;
  value = toUnix(value);
  result = toUnix(basepath.normalize(value));
  if (
    value.startsWith('./') &&
    !result.startsWith('./') &&
    !result.startsWith('..')
  ) {
    result = './' + result;
  } else if (value.startsWith('//') && !result.startsWith('//')) {
    result = value.startsWith('//./') ? '//.' + result : '/' + result;
  }
  return result;
}

export function joinSafe(...values: string[]) {
  let result = toUnix(basepath.join(...values.map((v) => toUnix(v))));

  if (values.length > 0) {
    const firstValue = toUnix(values[0]);
    if (
      firstValue.startsWith('./') &&
      !result.startsWith('./') &&
      !result.startsWith('..')
    ) {
      result = './' + result;
    } else if (firstValue.startsWith('//') && !result.startsWith('//')) {
      result = firstValue.startsWith('//./') ? '//.' + result : '/' + result;
    }
  }
  return result;
}

/**
 * Given two absolute file paths, generates a valid ESM relative import path
 * from the 'importer' file to the 'exporter' file.
 *
 * @example
 * ```ts
 * getRelativeImportPath('/path/to/importer.ts', '/path/to/exporter.ts')
 * // => './exporter'
 * getRelativeImportPath('/path/to/importer.ts', '/path/to/sub/exporter.ts')
 * // => './sub/exporter'
 * getRelativeImportPath('/path/to/importer.ts', '/path/sibling/exporter.ts')
 * // => '../sibling/exporter'
 * ```
 *
 * This function handles path normalization, cross-platform separators, and
 * ensures the path is a valid ESM relative specifier (e.g., starts with './').
 *
 * @param importerFilePath - The absolute path of the file that will contain the import statement.
 * @param exporterFilePath - The absolute path of the file being imported.
 * @param [includeFileExtension=false] - Whether the import path should include the file extension, defaults to false.
 * @returns The relative import path string.
 */
export function getRelativeImportPath(
  importerFilePath: string,
  exporterFilePath: string,
  includeFileExtension = false,
): string {
  if (!basepath.isAbsolute(importerFilePath))
    throw new Error(
      `'importerFilePath' is not an absolute path. "${importerFilePath}"`,
    );
  if (!basepath.isAbsolute(exporterFilePath))
    throw new Error(
      `'exporterFilePath' is not an absolute path. "${exporterFilePath}"`,
    );

  // Get the directory of the importer file.
  const importerDir = basepath.dirname(importerFilePath);

  // Calculate the relative path from the importer's directory to the exporter file.
  const relativePath = basepath.relative(importerDir, exporterFilePath);

  // Convert to posix path
  let posixPath = basepath.posix.join(...relativePath.split(basepath.sep));

  // Ensure the path starts with './' for same-directory imports.
  // A relative specifier must start with './' or '../'.
  if (!posixPath.startsWith('./') && !posixPath.startsWith('../')) {
    posixPath = `./${posixPath}`;
  }

  if (!includeFileExtension) {
    const ext = basepath.extname(posixPath);
    if (ext && posixPath.endsWith(ext)) {
      posixPath = posixPath.slice(0, -ext.length);
    }
  }

  return posixPath;
}
