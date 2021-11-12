import { Verbs } from '../types';

export const generalJSTypes = [
  'number',
  'string',
  'null',
  'unknown',
  'undefined',
  'object',
  'blob',
];

export const generalJSTypesWithArray = generalJSTypes.reduce<string[]>(
  (acc, type) => [...acc, type, `Array<${type}>`, `${type}[]`],
  [],
);

export const VERBS_WITH_BODY = [Verbs.POST, Verbs.PUT, Verbs.PATCH, Verbs.DELETE];

export const URL_REGEX = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;
