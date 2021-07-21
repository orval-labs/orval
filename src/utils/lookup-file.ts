import { existsSync, readFileSync, statSync } from 'fs-extra';
import { dirname, join } from 'upath';

export function lookupFile(
  dir: string,
  formats: string[],
  pathOnly = false,
): string | undefined {
  for (const format of formats) {
    const fullPath = join(dir, format);
    if (existsSync(fullPath) && statSync(fullPath).isFile()) {
      return pathOnly ? fullPath : readFileSync(fullPath, 'utf-8');
    }
  }
  const parentDir = dirname(dir);
  if (parentDir !== dir) {
    return lookupFile(parentDir, formats, pathOnly);
  }
}
