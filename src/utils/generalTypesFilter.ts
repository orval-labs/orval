import uniq from 'lodash/uniq';

export const generalJSTypes = [
  'number',
  'string',
  'null',
  'unknown',
  'undefined',
  'object',
  'blob'
];

export const generalJSTypesWithArray = generalJSTypes.reduce<string[]>(
  (acc, type) => [...acc, type, `Array<${type}>`, `${type}[]`],
  []
);

export const generalTypesFilter = (values: string[] = []) => {
  return uniq(values.filter(value => !generalJSTypesWithArray.includes(value)));
};
