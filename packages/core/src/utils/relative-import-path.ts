import path from 'node:path';

/**
 * Given two absolute file paths, generates a valid ESM relative import path
 * from the 'importer' file to the 'exporter' file.
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
  if (!path.isAbsolute(importerFilePath))
    throw new Error(
      `'importerFilePath' is not an absolute path. "${importerFilePath}"`,
    );
  if (!path.isAbsolute(exporterFilePath))
    throw new Error(
      `'exporterFilePath' is not an absolute path. "${exporterFilePath}"`,
    );

  // Get the directory of the importer file
  const importerDir = path.dirname(importerFilePath);

  // Calculate the relative path from the importer's directory to the exporter file.
  const relativePath = path.relative(importerDir, exporterFilePath);

  // Convert to posix path
  let posixPath = path.posix.join(...relativePath.split(path.sep));

  // Ensure the path starts with './' for same-directory imports.
  // A relative specifier must start with '/', './', or '../'.
  if (!posixPath.startsWith('./') && !posixPath.startsWith('../')) {
    posixPath = `./${posixPath}`;
  }

  if (!includeFileExtension) {
    posixPath = posixPath.replace(
      new RegExp(`${path.extname(posixPath)}$`),
      '',
    );
  }

  return posixPath;
}
