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
  require(join(__dirname, '../../package.json')) as PackageJson;
