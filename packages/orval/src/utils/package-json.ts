import { log, PackageJson } from '@orval/core';
import chalk from 'chalk';
import findUp from 'find-up';
import fs from 'fs-extra';
import yaml from 'js-yaml';
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
      return await maybeReplaceCatalog(pkg, workspace);
    }
    return;
  }

  const normalizedPath = normalizePath(packageJson, workspace);
  if (fs.existsSync(normalizedPath)) {
    const pkg = await import(normalizedPath);

    return await maybeReplaceCatalog(pkg, workspace);
  }
  return;
};

const maybeReplaceCatalog = async (
  pkg: PackageJson,
  workspace: string,
): Promise<PackageJson> => {
  let hasCatalog = false;
  for (const kvp of [
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {}),
  ]) {
    if (kvp[1].startsWith('catalog:')) {
      hasCatalog = true;
      break;
    }
  }
  if (!hasCatalog) return pkg;

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
      const namedCatalog = version.substring(8); // 'catalog:' is 8 characters long
      const catalog = pnpmWorkspaceFile.catalogs?.[namedCatalog];
      if (!catalog) {
        log(
          `⚠️  ${chalk.yellow(`when reading from pnpm-workspace.yaml, '${version}' substitution for the package '${packageName}' failed as there were no matching catalog named '${namedCatalog}'. (available named catalogs are: ${Object.keys(pnpmWorkspaceFile.catalogs ?? {}).join(', ')})`)}`,
        );
        continue;
      }
      const sub = catalog[packageName];
      if (!sub) {
        log(
          `⚠️  ${chalk.yellow(`when reading from pnpm-workspace.yaml, '${version}' substitution for the package '${packageName}' failed as there were no package in the catalog named '${namedCatalog}'. (packages in the catalog are: ${Object.keys(catalog).join(', ')})`)}`,
        );
        continue;
      }
      dependencies[packageName] = sub;
    }
  }
};
