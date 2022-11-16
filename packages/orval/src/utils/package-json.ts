import { PackageJson } from '@orval/core';
import findUp from 'find-up';
import { existsSync } from 'fs-extra';
import { normalizePath } from './options';

export const loadPackageJson = async (
  packageJson?: string,
  workspace = process.cwd(),
): Promise<PackageJson | undefined> => {
  if (!packageJson) {
    const pkgPath = await findUp(['package.json'], {
      cwd: workspace,
    });
    if (pkgPath) {
      const pkg = await import(pkgPath);
      return pkg;
    }
    return;
  }

  const normalizedPath = normalizePath(packageJson, workspace);
  if (existsSync(normalizedPath)) {
    const pkg = await import(normalizedPath);

    return pkg;
  }
  return;
};
