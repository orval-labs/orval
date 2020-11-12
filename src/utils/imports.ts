import { join } from 'path';
import { isString } from './is';

export const dynamicImport = <T>(
  toImport?: T | string,
  from = process.cwd(),
): T => (isString(toImport) ? require(join(from, toImport)) : toImport);
