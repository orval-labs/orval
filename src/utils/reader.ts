import {readFileSync} from 'fs';
import {join} from 'path';

export const dynamicReader = (path: string, from = process.cwd()) =>
  readFileSync(join(from, path), 'utf-8');
