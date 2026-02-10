import basepath from 'node:path';

import { isFunction, isStringLike } from './assertion';
import { getExtension } from './extension';

// override path to support windows paths
// https://github.com/anodynos/upath/blob/master/source/code/upath.coffee
type Path = typeof basepath;
const path = {} as Path;

for (const [propName, propValue] of Object.entries(basepath)) {
  // @ts-ignore
  path[propName] = isFunction(propValue)
    ? ((propName) => {
        return (...args: any[]) => {
          args = args.map((p) => {
            return isStringLike(p) ? toUnix(p) : p;
          });

          // @ts-ignore
          const result = basepath[propName](...args);
          return isStringLike(result) ? toUnix(result) : result;
        };
      })(propName)
    : propValue;
}

const { join, resolve, extname, dirname, basename, isAbsolute } = path;
export { basename, dirname, extname, isAbsolute, join, resolve };

/**
 * Behaves exactly like `path.relative(from, to)`, but keeps the first meaningful "./"
 */
export function relativeSafe(from: string, to: string) {
  const normalizedRelativePath = path.relative(from, to);
  /**
   * Prepend "./" to every path and then use normalizeSafe method to normalize it
   * normalizeSafe doesn't remove meaningful leading "./"
   */
  const relativePath = normalizeSafe(`.${separator}${normalizedRelativePath}`);
  return relativePath;
}

export function getSchemaFileName(path: string) {
  return path
    .replace(`.${getExtension(path)}`, '')
    .slice(path.lastIndexOf('/') + 1);
}

export const separator = '/';

const toUnix = function (value: string) {
  value = value.replaceAll('\\', '/');
  value = value.replaceAll(/(?<!^)\/+/g, '/'); // replace doubles except beginning for UNC path
  return value;
};

export function normalizeSafe(value: string) {
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
    result = value.startsWith('//./') ? '//.' + result : '/' + result;
  }
  return result;
}

export function joinSafe(...values: string[]) {
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
      result = firstValue.startsWith('//./') ? '//.' + result : '/' + result;
    }
  }
  return result;
}
