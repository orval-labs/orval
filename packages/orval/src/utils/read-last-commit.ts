import { upath } from '@orval/core';
import fs from 'fs-extra';
import { getNodeModulesPath } from './node-modules';

export const readLastCommit = async (workspace: string) => {
  const nodeModulesPath = await getNodeModulesPath(workspace);

  if (!nodeModulesPath) return;

  return fs.readFileSync(
    upath.join(nodeModulesPath, './.orval/last-commit'),
    'utf8',
  );
};
