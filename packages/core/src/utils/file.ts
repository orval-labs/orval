import fs from 'node:fs';
import path from 'node:path';

import { escapePath, glob } from 'tinyglobby';

import { isDirectory } from './assertion';

/**
 * Escapes glob metacharacters (`*?()[]{}!`, a leading `!`, and a literal
 * backslash) in a path segment so it can be embedded in a glob pattern and
 * only ever match itself. Re-exported from `tinyglobby`, the glob engine
 * {@link removeFilesAndEmptyFolders} runs on, so callers that build patterns
 * around a user-configured directory name (which may contain those
 * characters) stay in step with whatever engine is in use.
 */
export { escapePath };

export function getFileInfo(
  target = '',
  {
    backupFilename = 'filename',
    extension = '.ts',
  }: { backupFilename?: string; extension?: string } = {},
) {
  const isDir = isDirectory(target);
  const filePath = isDir
    ? path.join(target, backupFilename + extension)
    : target;
  const pathWithoutExtension = filePath.replace(/\.[^/.]+$/, '');
  const dir = path.dirname(filePath);
  const filename = path.basename(
    filePath,
    extension.startsWith('.') ? extension : `.${extension}`,
  );

  return {
    path: filePath,
    pathWithoutExtension,
    extension,
    isDirectory: isDir,
    dirname: dir,
    filename,
  };
}

export async function removeFilesAndEmptyFolders(
  patterns: string[],
  dir: string,
  /**
   * Set `followSymbolicLinks` to `false` in a directory that Orval shares with
   * the user. A symlinked subdirectory would otherwise let the glob reach
   * files outside `dir` and delete them.
   */
  { followSymbolicLinks = true }: { followSymbolicLinks?: boolean } = {},
) {
  const files = await glob(patterns, {
    cwd: dir,
    absolute: true,
    followSymbolicLinks,
  });

  // Remove files
  await Promise.all(files.map((file) => fs.promises.unlink(file)));

  // Find and remove empty directories
  const directories = await glob(['**/*'], {
    cwd: dir,
    absolute: true,
    onlyDirectories: true,
    followSymbolicLinks,
  });

  // Sort directories by depth (deepest first) to ensure we can remove nested empty folders
  const sortedDirectories = directories.toSorted((a, b) => {
    const depthA = a.split('/').length;
    const depthB = b.split('/').length;
    return depthB - depthA;
  });

  // Remove empty directories
  for (const directory of sortedDirectories) {
    try {
      const contents = await fs.promises.readdir(directory);
      if (contents.length === 0) {
        await fs.promises.rmdir(directory);
      }
    } catch {
      // Directory might have been removed already or doesn't exist
      // Continue with next directory
    }
  }
}
