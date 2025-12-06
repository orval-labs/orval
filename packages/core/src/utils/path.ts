import basepath from 'node:path';

import { isUrl } from './assertion';
import { getExtension } from './extension';
import { getFileInfo } from './file';

// override path to support windows paths
// https://github.com/anodynos/upath/blob/master/source/code/upath.coffee
type Path = typeof basepath;
const path = {} as Path;

const isFunction = (val: any) => typeof val == 'function';

const isString = (val: any) => {
  if (typeof val === 'string') {
    return true;
  }

  if (typeof val === 'object' && val !== null) {
    return Object.toString.call(val) == '[object String]';
  }

  return false;
};

for (const [propName, propValue] of Object.entries(basepath)) {
  if (isFunction(propValue)) {
    // @ts-ignore
    path[propName] = ((propName) => {
      return (...args: any[]) => {
        args = args.map((p) => {
          return isString(p) ? toUnix(p) : p;
        });

        // @ts-ignore
        const result = basepath[propName](...args);
        return isString(result) ? toUnix(result) : result;
      };
    })(propName);
  } else {
    // @ts-ignore
    path[propName] = propValue;
  }
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
