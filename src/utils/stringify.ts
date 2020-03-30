import {
  isBoolean,
  isFunction,
  isNull,
  isNumber,
  isString,
  isUndefined
} from './is';

export const stringify = (
  data?: string | any[] | {[key: string]: any}
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
