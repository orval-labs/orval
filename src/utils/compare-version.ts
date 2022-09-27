import { compare, CompareOperator } from 'compare-versions';

export const compareVersions = (
  firstVersion: string,
  secondVersions: string,
  operator: CompareOperator = '>=',
) => {
  if (firstVersion === 'latest') {
    return true;
  }

  return compare(
    firstVersion.replace(/(\s(.*))/, ''),
    secondVersions,
    operator,
  );
};
