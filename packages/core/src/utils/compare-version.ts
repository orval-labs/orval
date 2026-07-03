import { compare, type CompareOperator } from 'compare-versions';

const getComparableVersion = (version: string) => {
  const npmAliasVersion = version.match(/^npm:(?:@[^/]+\/)?[^@]+@(.+)$/)?.[1];

  if (npmAliasVersion) {
    return npmAliasVersion;
  }

  if (version.startsWith('npm:')) {
    return 'latest';
  }

  return version;
};

export function compareVersions(
  firstVersion: string,
  secondVersions: string,
  operator: CompareOperator = '>=',
) {
  const comparableVersion = getComparableVersion(firstVersion);

  if (comparableVersion === 'latest' || comparableVersion === '*') {
    return true;
  }

  // Handle workspace catalog references (pnpm/bun)
  // catalog: or catalog:name format - assume latest version
  if (comparableVersion.startsWith('catalog:')) {
    return true;
  }

  return compare(
    comparableVersion.replace(/(\s(.*))/, ''),
    secondVersions,
    operator,
  );
}
