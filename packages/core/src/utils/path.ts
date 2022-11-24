import path from 'path';
import { isUrl } from './assertion';
import { getExtension } from './extension';
import { getFileInfo } from './file';

/**
 * Behaves exactly like `path.relative(from, to)`, but keeps the first meaningful "./"
 */
export const relativeSafe = (from: string, to: string) => {
  const normalizedRelativePath = path.relative(from, to);
  /**
   * Prepend "./" to every path and then use normalizeSafe method to normalize it
   * normalizeSafe doesn't remove meaningful leading "./"
   */
  const relativePath = normalizeSafe(`.${separator}${normalizedRelativePath}`);
  return relativePath;
};

export const getSpecName = (specKey: string, target: string) => {
  if (isUrl(specKey)) {
    const url = new URL(target);
    return specKey
      .replace(url.origin, '')
      .replace(getFileInfo(url.pathname).dirname, '')
      .replace(`.${getExtension(specKey)}`, '');
  }

  return (
    '/' +
    path
      .normalize(path.relative(getFileInfo(target).dirname, specKey))
      .split('../')
      .join('')
      .replace(`.${getExtension(specKey)}`, '')
  );
};

export const getSchemaFileName = (path: string) => {
  return path
    .replace(`.${getExtension(path)}`, '')
    .slice(path.lastIndexOf('/') + 1);
};

export const separator = '/';

const toUnix = function (value: string) {
  value = value.replace(/\\/g, '/');
  value = value.replace(/(?<!^)\/+/g, '/'); // replace doubles except beginning for UNC path
  return value;
};

export const normalizeSafe = (value: string) => {
  let result;
  value = toUnix(value);
  result = path.normalize(value);
  if (
    value.startsWith('./') &&
    !result.startsWith('./') &&
    !result.startsWith('..')
  ) {
    result = './' + result;
  } else if (value.startsWith('//') && !result.startsWith('//')) {
    if (value.startsWith('//./')) {
      result = '//.' + result;
    } else {
      result = '/' + result;
    }
  }
  return result;
};

export const joinSafe = function (...values: string[]) {
  let result = path.join(...values);

  if (values.length > 0) {
    const firstValue = toUnix(values[0]);
    if (
      firstValue.startsWith('./') &&
      !result.startsWith('./') &&
      !result.startsWith('..')
    ) {
      result = './' + result;
    } else if (firstValue.startsWith('//') && !result.startsWith('//')) {
      if (firstValue.startsWith('//./')) {
        result = '//.' + result;
      } else {
        result = '/' + result;
      }
    }
  }
  return result;
};
