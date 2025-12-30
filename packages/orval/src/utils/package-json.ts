import { dynamicImport, isString, log, type PackageJson } from '@orval/core';
import chalk from 'chalk';
import { findUp } from 'find-up';
import fs from 'fs-extra';
import yaml from 'js-yaml';

import { normalizePath } from './options';

export const loadPackageJson = async (
  packageJson?: string,
  workspace = process.cwd(),
): Promise<PackageJson | undefined> => {
  if (!packageJson) {
    const pkgPath = await findUp(['package.json'], { cwd: workspace });
    if (pkgPath) {
      const pkg = await dynamicImport<unknown>(pkgPath, workspace);

      if (isPackageJson(pkg)) {
        return await maybeReplaceCatalog(pkg, workspace);
      } else {
        throw new Error('Invalid package.json file');
      }
    }
    return;
  }

  const normalizedPath = normalizePath(packageJson, workspace);
  if (fs.existsSync(normalizedPath)) {
    const pkg = await dynamicImport<unknown>(normalizedPath);

    if (isPackageJson(pkg)) {
      return await maybeReplaceCatalog(pkg, workspace);
    } else {
      throw new Error(`Invalid package.json file: ${normalizedPath}`);
    }
  }
  return;
};

const isPackageJson = (obj: any): obj is PackageJson =>
  typeof obj === 'object' && obj !== null;

const maybeReplaceCatalog = async (
  pkg: PackageJson,
  workspace: string,
): Promise<PackageJson> => {
  if (
    ![
      ...Object.entries(pkg.dependencies ?? {}),
      ...Object.entries(pkg.devDependencies ?? {}),
      ...Object.entries(pkg.peerDependencies ?? {}),
    ].some(([, value]) => isString(value) && value.startsWith('catalog:'))
  ) {
    return pkg;
  }

  const filePath = await findUp('pnpm-workspace.yaml', { cwd: workspace });
  if (!filePath) {
    log(
      `⚠️  ${chalk.yellow('package.json contains pnpm catalog: in dependencies, but no pnpm-workspace.yaml was found.')}`,
    );
    return pkg;
  }
  const file = await fs.readFile(filePath, 'utf8');

  const pnpmWorkspaceFile = yaml.load(file) as Record<string, any>;
  performSubstitution(pkg.dependencies, pnpmWorkspaceFile);
  performSubstitution(pkg.devDependencies, pnpmWorkspaceFile);
  performSubstitution(pkg.peerDependencies, pnpmWorkspaceFile);

  return pkg;
};

const performSubstitution = (
  dependencies: Record<string, string> | undefined,
  pnpmWorkspaceFile: Record<string, any>,
) => {
  if (!dependencies) return;
  for (const [packageName, version] of Object.entries(dependencies)) {
    if (version === 'catalog:' || version === 'catalog:default') {
      if (!pnpmWorkspaceFile.catalog) {
        log(
          `⚠️  ${chalk.yellow(`when reading from pnpm-workspace.yaml, catalog: substitution for the package '${packageName}' failed as there were no default catalog.`)}`,
        );
        continue;
      }
      const sub = pnpmWorkspaceFile.catalog[packageName];
      if (!sub) {
        log(
          `⚠️  ${chalk.yellow(`when reading from pnpm-workspace.yaml, catalog: substitution for the package '${packageName}' failed as there were no matching package in the default catalog.`)}`,
        );
        continue;
      }
      dependencies[packageName] = sub;
    } else if (version.startsWith('catalog:')) {
      const catalogName = version.slice('catalog:'.length);
      const catalog = pnpmWorkspaceFile.catalogs?.[catalogName];
      if (!catalog) {
        log(
          `⚠️  ${chalk.yellow(`when reading from pnpm-workspace.yaml, '${version}' substitution for the package '${packageName}' failed as there were no matching catalog named '${catalogName}'. (available named catalogs are: ${Object.keys(pnpmWorkspaceFile.catalogs ?? {}).join(', ')})`)}`,
        );
        continue;
      }
      const sub = catalog[packageName];
      if (!sub) {
        log(
          `⚠️  ${chalk.yellow(`when reading from pnpm-workspace.yaml, '${version}' substitution for the package '${packageName}' failed as there were no package in the catalog named '${catalogName}'. (packages in the catalog are: ${Object.keys(catalog).join(', ')})`)}`,
        );
        continue;
      }
      dependencies[packageName] = sub;
    }
  }
};
