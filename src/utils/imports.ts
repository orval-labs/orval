import {join} from 'path';

export const dynamicImport = (path: string, from = process.cwd()) =>
  require(join(from, path));
