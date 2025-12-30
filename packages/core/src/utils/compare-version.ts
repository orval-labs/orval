import { compare, type CompareOperator } from 'compare-versions';

export function compareVersions(
  firstVersion: string,
  secondVersions: string,
  operator: CompareOperator = '>=',
) {
  if (firstVersion === 'latest' || firstVersion === '*') {
    return true;
  }

  // Handle workspace catalog references (pnpm/bun)
  // catalog: or catalog:name format - assume latest version
  if (firstVersion.startsWith('catalog:')) {
    return true;
  }

  return compare(
    firstVersion.replace(/(\s(.*))/, ''),
    secondVersions,
    operator,
  );
}
