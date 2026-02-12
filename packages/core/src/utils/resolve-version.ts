import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import type { PackageJson } from '../types';

export function resolveInstalledVersion(
  packageName: string,
  fromDir: string,
): string | undefined {
  try {
    const require = createRequire(join(fromDir, 'noop.js'));
    try {
      const pkg = require(`${packageName}/package.json`) as {
        version?: string;
      };
      return pkg.version;
    } catch (directError: unknown) {
      if (
        directError instanceof Error &&
        'code' in directError &&
        (directError as NodeJS.ErrnoException).code ===
          'ERR_PACKAGE_PATH_NOT_EXPORTED'
      ) {
        const entryPath = require.resolve(packageName);
        let dir = dirname(entryPath);
        while (dir !== parse(dir).root) {
          const pkgPath = join(dir, 'package.json');
          if (existsSync(pkgPath)) {
            const pkgData = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
              name?: string;
              version?: string;
            };
            if (pkgData.name === packageName) {
              return pkgData.version;
            }
          }
          dir = dirname(dir);
        }
        return undefined;
      }
      throw directError;
    }
  } catch {
    return undefined;
  }
}

export function resolveInstalledVersions(
  packageJson: PackageJson,
  fromDir: string,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const allDeps = new Set([
    ...Object.keys(packageJson.dependencies ?? {}),
    ...Object.keys(packageJson.devDependencies ?? {}),
    ...Object.keys(packageJson.peerDependencies ?? {}),
  ]);
  for (const pkgName of allDeps) {
    const version = resolveInstalledVersion(pkgName, fromDir);
    if (version) {
      resolved[pkgName] = version;
    }
  }
  return resolved;
}
