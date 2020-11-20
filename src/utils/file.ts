import { basename, dirname, join } from 'path';
import { isDirectory } from './is';

export const getFileInfo = (
  target: string = '',
  backupFilename: string = 'filename',
) => {
  const isDir = isDirectory(target);
  const extension = '.ts';
  const path = isDir ? join(target, backupFilename + extension) : target;
  const pathWithoutExtension = path.replace(/\.[^/.]+$/, '');
  const dir = dirname(path);
  const filename = basename(path, '.ts');

  return {
    path,
    pathWithoutExtension,
    extension,
    isDirectory: isDir,
    dirname: dir,
    filename,
  };
};
