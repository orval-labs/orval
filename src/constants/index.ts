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

export const VERBS_WITH_BODY = [Verbs.POST, Verbs.PUT, Verbs.PATCH];

export const URL_REGEX = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)*[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;

export const SPECIAL_CHAR_REGEX = /[^\w\s]/g;

export const SPECIAL_CHAR_REGEX_DEEP = /[^\w\s]|[_]/g;
