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