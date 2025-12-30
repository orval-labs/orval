import fs from 'node:fs';
import path from 'node:path';

import { globby } from 'globby';

import { isDirectory } from './assertion';

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
) {
  const files = await globby(patterns, {
    cwd: dir,
    absolute: true,
  });

  // Remove files
  await Promise.all(files.map((file) => fs.promises.unlink(file)));

  // Find and remove empty directories
  const directories = await globby(['**/*'], {
    cwd: dir,
    absolute: true,
    onlyDirectories: true,
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
