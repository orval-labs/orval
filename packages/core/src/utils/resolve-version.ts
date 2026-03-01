import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import type { PackageJson } from '../types.ts';

export function resolveInstalledVersion(
  packageName: string,
  fromDir: string,
): string | undefined {
  try {
    const require = createRequire(path.join(fromDir, 'noop.js'));
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
        let dir = path.dirname(entryPath);
        while (dir !== path.parse(dir).root) {
          const pkgPath = path.join(dir, 'package.json');
          if (existsSync(pkgPath)) {
            const pkgData = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
              name?: string;
              version?: string;
            };
            if (pkgData.name === packageName) {
              return pkgData.version;
            }
          }
          dir = path.dirname(dir);
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
