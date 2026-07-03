import {
  compareVersions,
  type PackageJson,
  type ZodVariantOption,
  type ZodVersionOption,
} from '@orval/core';

const getZodPackageVersion = (packageJson: PackageJson) => {
  return (
    packageJson.resolvedVersions?.zod ??
    packageJson.dependencies?.zod ??
    packageJson.devDependencies?.zod ??
    packageJson.peerDependencies?.zod
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

/**
 * Resolves whether to emit Zod 4-style output.
 *
 * An explicit `override.zod.version` of `3` or `4` always wins; `'auto'` (the
 * default) falls back to inferring from the output project's resolved `zod`
 * version via {@link isZodVersionV4}. When no package metadata is available,
 * `'auto'` now defaults to Zod 4 so fresh or partially-installed workspaces
 * still get the modern baseline. This keeps generation deterministic when a
 * target is pinned while preserving package-detection for `'auto'`.
 */
export const resolveIsZodV4 = (
  version: ZodVersionOption | undefined,
  packageJson: PackageJson | undefined,
): boolean => {
  if (version === 4) {
    return true;
  }

  if (version === 3) {
    return false;
  }

  // 'auto' (or unset) — infer from the installed/resolved zod version and
  // default to Zod 4 when the target workspace has no detectable zod version
  // yet. Treat "no packageJson" and "packageJson without a detectable zod
  // version" identically so partially-installed workspaces still get the
  // modern baseline instead of silently falling back to Zod 3.
  if (!packageJson || !getZodPackageVersion(packageJson)) {
    return true;
  }

  return isZodVersionV4(packageJson);
};

export const assertZodTarget = ({
  variant,
  isZodV4,
}: {
  variant: ZodVariantOption | undefined;
  isZodV4: boolean;
}) => {
  if (variant === 'mini' && !isZodV4) {
    throw new Error(
      "Zod Mini requires Zod 4 output. Use override.zod.version: 4 or install zod@^4 when override.zod.version is 'auto'.",
    );
  }
};

export const getZodImportSource = (variant: ZodVariantOption | undefined) =>
  variant === 'mini' ? 'zod/mini' : 'zod';

export const getZodTypeName = (variant: ZodVariantOption | undefined) =>
  variant === 'mini' ? 'ZodMiniType' : 'ZodType';

export const getZodDateFormat = (isZodV4: boolean) => {
  return isZodV4 ? 'iso.date' : 'date';
};

export const getZodTimeFormat = (isZodV4: boolean) => {
  return isZodV4 ? 'iso.time' : 'time';
};

export const getZodDateTimeFormat = (isZodV4: boolean) => {
  return isZodV4 ? 'iso.datetime' : 'datetime';
};

type ParameterDefinitions = Record<string, unknown>;
type ParameterFunction = [string, ParameterDefinitions | undefined];
export const getParameterFunctions = (
  isZodV4: boolean,
  strict: boolean,
  parameters: ParameterDefinitions,
): ParameterFunction[] => {
  if (isZodV4 && strict) {
    return [['strictObject', parameters]];
  } else {
    return strict
      ? [
          ['object', parameters],
          ['strict', undefined],
        ]
      : [['object', parameters]];
  }
};

export const getObjectFunctionName = (isZodV4: boolean, strict: boolean) => {
  return isZodV4 && strict ? 'strictObject' : 'object';
};

/**
 * Returns the object constructor to use for open/generic objects.
 *
 * - Zod v4 supports `zod.looseObject({...})` directly.
 * - Zod v3 falls back to `zod.object({...})` and is finalized with
 *   `.passthrough()` during parsing.
 */
export const getLooseObjectFunctionName = (isZodV4: boolean) => {
  return isZodV4 ? 'looseObject' : 'object';
};
