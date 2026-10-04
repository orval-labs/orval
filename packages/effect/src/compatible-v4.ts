import {
  compareVersions,
  type EffectVersionOption,
  type PackageJson,
} from '@orval/core';

const getEffectPackageVersion = (packageJson: PackageJson) => {
  return (
    packageJson.resolvedVersions?.effect ??
    packageJson.dependencies?.effect ??
    packageJson.devDependencies?.effect ??
    packageJson.peerDependencies?.effect
  );
};

export const isEffectVersionV4 = (packageJson: PackageJson) => {
  const version = getEffectPackageVersion(packageJson);

  if (!version) {
    return false;
  }

  const withoutPrerelease = version.split('-')[0];

  return compareVersions(withoutPrerelease, '4.0.0');
};

/**
 * Resolves whether to emit Effect 4 Schema output.
 *
 * An explicit `override.effect.version` of `3` or `4` always wins; `'auto'`
 * (the default) infers from the output project's resolved `effect` version via
 * {@link isEffectVersionV4}, and falls back to Effect 4, the current major,
 * when no `effect` version can be detected.
 */
export const resolveIsEffectV4 = (
  version: EffectVersionOption | undefined,
  packageJson: PackageJson | undefined,
): boolean => {
  if (version === 4) {
    return true;
  }

  if (version === 3) {
    return false;
  }

  if (!packageJson || !getEffectPackageVersion(packageJson)) {
    return true;
  }

  // A specifier that is not a version (`workspace:*`, `file:…`) cannot be
  // compared, so it counts as undetectable too.
  try {
    return isEffectVersionV4(packageJson);
  } catch {
    return true;
  }
};
