import { compareVersions, PackageJson } from '@orval/core';

const getZodPackageVersion = (packageJson: PackageJson) => {
  return (
    packageJson.dependencies?.['zod'] ??
    packageJson.devDependencies?.['zod'] ??
    packageJson.peerDependencies?.['zod']
  );
};

export const isZodVersionV4 = (packageJson: PackageJson) => {
  const version = getZodPackageVersion(packageJson);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '4.0.0');
};
