import { readFileSync } from 'fs';
import { join } from 'path';

export type PackageJson = {
  name: string;
  version: string;
  description?: string;
  license?: string;
  author?: {
    name: string;
    email: string;
  };
  repository?: {
    type: string;
    url: string;
  };
};

export const getPackage = () =>
  JSON.parse(
    readFileSync(join(__dirname, '../../package.json'), 'utf-8'),
  ) as PackageJson;
