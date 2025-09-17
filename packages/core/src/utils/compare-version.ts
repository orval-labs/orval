import { compare, type CompareOperator } from 'compare-versions';

export const compareVersions = (
  firstVersion: string,
  secondVersions: string,
  operator: CompareOperator = '>=',
) => {
  if (firstVersion === 'latest' || firstVersion === '*') {
    return true;
  }

  return compare(
    firstVersion.replace(/(\s(.*))/, ''),
    secondVersions,
    operator,
  );
};
