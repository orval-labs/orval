import { get } from 'lodash';
import { SPECIAL_CHAR_REGEX, SPECIAL_CHAR_REGEX_DEEP } from '../constants';
import {
  isBoolean,
  isFunction,
  isNull,
  isNumber,
  isString,
  isUndefined,
} from './is';

export const stringify = (
  data?: string | any[] | { [key: string]: any },
): string | undefined => {
  if (isUndefined(data) || isNull(data)) {
    return;
  }

  if (isString(data)) {
    return `'${data}'`;
  }

  if (isNumber(data) || isBoolean(data) || isFunction(data)) {
    return `${data}`;
  }

  if (Array.isArray(data)) {
    return `[${data.map(stringify).join(', ')}]`;
  }

  return Object.entries(data).reduce((acc, [key, value], index, arr) => {
    const strValue = stringify(value);
    if (arr.length === 1) {
      return `{ ${key}: ${strValue}, }`;
    }

    if (!index) {
      return `{ ${key}: ${strValue}, `;
    }

    if (arr.length - 1 === index) {
      return acc + `${key}: ${strValue}, }`;
    }

    return acc + `${key}: ${strValue}, `;
  }, '');
};

export const sanitize = (value: string, deep = true) =>
  value.replace(deep ? SPECIAL_CHAR_REGEX_DEEP : SPECIAL_CHAR_REGEX, '');

export const toObjectString = <T>(props: T[], path?: keyof T) => {
  if (!props.length) {
    return '';
  }

  const arrayOfString = path ? props.map((prop) => get(prop, path)) : props;

  return arrayOfString.join(',\n    ') + ',';
};

const NUMBERS = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

export const getNumberWord = (num: number) => {
  const arrayOfNumber = num.toString().split('') as (keyof typeof NUMBERS)[];
  return arrayOfNumber.reduce((acc, n) => acc + NUMBERS[n], '');
};
