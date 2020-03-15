import {readFileSync} from 'fs';
import {join} from 'path';

export const getPackage = () =>
  JSON.parse(readFileSync(join(__dirname, '../../package.json'), 'utf-8'));
