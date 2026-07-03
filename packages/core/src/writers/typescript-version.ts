import type { PackageJson } from '../types';
import { compareVersions } from '../utils';

const getTypeScriptVersion = (packageJson?: PackageJson): string => {
  return (
    packageJson?.resolvedVersions?.typescript ??
    packageJson?.dependencies?.typescript ??
    packageJson?.devDependencies?.typescript ??
    packageJson?.peerDependencies?.typescript ??
    '4.4.0'
  );
};

export const hasTypeScriptAwaitedType = (packageJson?: PackageJson) =>
  compareVersions(getTypeScriptVersion(packageJson), '4.5.0');
