import { upath } from '@orval/core';
import { execSync } from 'child_process';
import fs from 'fs-extra';
import { getNodeModulesPath } from './node-modules';

export const writeLastCommit = async (workspace: string) => {
  const nodeModulesPath = await getNodeModulesPath(workspace);

  if (!nodeModulesPath) return;

  fs.outputFileSync(
    upath.join(nodeModulesPath, './.orval/last-commit'),
    execSync('git rev-parse HEAD').toString(),
  );
};
