import fs from 'node:fs';
import path from 'node:path';

const isFile = (file: string): boolean =>
  fs.statSync(file, { throwIfNoEntry: false })?.isFile() ?? false;

/**
 * Walks from `cwd` up to the filesystem root and returns, nearest first, one
 * path per directory that holds any of `names` (tried in order) as a file.
 */
export function findUpMultiple(
  names: string | string[],
  cwd: string,
): string[] {
  const found: string[] = [];
  for (let dir = path.resolve(cwd); ; dir = path.dirname(dir)) {
    const file = [names]
      .flat()
      .map((name) => path.join(dir, name))
      .find(isFile);
    if (file) found.push(file);
    if (path.dirname(dir) === dir) return found;
  }
}

/** The nearest of `names` at or above `cwd`, or `undefined`. */
export const findUp = (
  names: string | string[],
  cwd: string,
): string | undefined => findUpMultiple(names, cwd)[0];
