import { compareVersions, type PackageJson } from '@orval/core';

const getFakerPackageVersion = (packageJson: PackageJson) => {
  return (
    packageJson.dependencies?.['@faker-js/faker'] ??
    packageJson.devDependencies?.['@faker-js/faker'] ??
    packageJson.peerDependencies?.['@faker-js/faker']
  );
};

export const isFakerVersionV9 = (packageJson: PackageJson) => {
  const version = getFakerPackageVersion(packageJson);

  if (!version) {
    return false;
  }

  const withoutRc = version.split('-')[0];

  return compareVersions(withoutRc, '9.0.0');
};
