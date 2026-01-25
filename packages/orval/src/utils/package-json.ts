import { dynamicImport, isString, log, type PackageJson } from '@orval/core';
import chalk from 'chalk';
import { findUp } from 'find-up';
import fs from 'fs-extra';
import yaml from 'js-yaml';

import { normalizePath } from './options';

type CatalogData = Pick<PackageJson, 'catalog' | 'catalogs'>;

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

const hasCatalogReferences = (pkg: PackageJson): boolean => {
  return [
    ...Object.entries(pkg.dependencies ?? {}),
    ...Object.entries(pkg.devDependencies ?? {}),
    ...Object.entries(pkg.peerDependencies ?? {}),
  ].some(([, value]) => isString(value) && value.startsWith('catalog:'));
};

const loadPnpmWorkspaceCatalog = async (
  workspace: string,
): Promise<CatalogData | undefined> => {
  const filePath = await findUp('pnpm-workspace.yaml', { cwd: workspace });
  if (!filePath) return undefined;
  try {
    const file = await fs.readFile(filePath, 'utf8');
    const data = yaml.load(file) as Record<string, any> | undefined;
    if (!data?.catalog && !data?.catalogs) return undefined;
    return { catalog: data.catalog, catalogs: data.catalogs };
  } catch {
    return undefined;
  }
};

const loadPackageJsonCatalog = async (
  workspace: string,
): Promise<CatalogData | undefined> => {
  const filePath = await findUp('package.json', { cwd: workspace });
  if (!filePath) return undefined;
  try {
    const pkg = await fs.readJson(filePath);
    if (!pkg?.catalog && !pkg?.catalogs) return undefined;
    return { catalog: pkg.catalog, catalogs: pkg.catalogs };
  } catch {
    return undefined;
  }
};

const loadYarnrcCatalog = async (
  workspace: string,
): Promise<CatalogData | undefined> => {
  const filePath = await findUp('.yarnrc.yml', { cwd: workspace });
  if (!filePath) return undefined;
  try {
    const file = await fs.readFile(filePath, 'utf8');
    const data = yaml.load(file) as Record<string, any> | undefined;
    if (!data?.catalog && !data?.catalogs) return undefined;
    return { catalog: data.catalog, catalogs: data.catalogs };
  } catch {
    return undefined;
  }
};

const maybeReplaceCatalog = async (
  pkg: PackageJson,
  workspace: string,
): Promise<PackageJson> => {
  if (!hasCatalogReferences(pkg)) {
    return pkg;
  }

  const catalogData =
    (await loadPnpmWorkspaceCatalog(workspace)) ??
    (await loadPackageJsonCatalog(workspace)) ??
    (await loadYarnrcCatalog(workspace));

  if (!catalogData) {
    log(
      `⚠️  ${chalk.yellow('package.json contains catalog: references, but no catalog source was found (checked: pnpm-workspace.yaml, package.json, .yarnrc.yml).')}`,
    );
    return pkg;
  }

  performSubstitution(pkg.dependencies, catalogData);
  performSubstitution(pkg.devDependencies, catalogData);
  performSubstitution(pkg.peerDependencies, catalogData);

  return pkg;
};

const performSubstitution = (
  dependencies: Record<string, string> | undefined,
  catalogData: CatalogData,
) => {
  if (!dependencies) return;
  for (const [packageName, version] of Object.entries(dependencies)) {
    if (version === 'catalog:' || version === 'catalog:default') {
      if (!catalogData.catalog) {
        log(
          `⚠️  ${chalk.yellow(`catalog: substitution for the package '${packageName}' failed as there is no default catalog.`)}`,
        );
        continue;
      }
      const sub = catalogData.catalog[packageName];
      if (!sub) {
        log(
          `⚠️  ${chalk.yellow(`catalog: substitution for the package '${packageName}' failed as there is no matching package in the default catalog.`)}`,
        );
        continue;
      }
      dependencies[packageName] = sub;
    } else if (version.startsWith('catalog:')) {
      const catalogName = version.slice('catalog:'.length);
      const catalog = catalogData.catalogs?.[catalogName];
      if (!catalog) {
        log(
          `⚠️  ${chalk.yellow(`'${version}' substitution for the package '${packageName}' failed as there is no matching catalog named '${catalogName}'. (available named catalogs are: ${Object.keys(catalogData.catalogs ?? {}).join(', ')})`)}`,
        );
        continue;
      }
      const sub = catalog[packageName];
      if (!sub) {
        log(
          `⚠️  ${chalk.yellow(`'${version}' substitution for the package '${packageName}' failed as there is no package in the catalog named '${catalogName}'. (packages in the catalog are: ${Object.keys(catalog).join(', ')})`)}`,
        );
        continue;
      }
      dependencies[packageName] = sub;
    }
  }
};
