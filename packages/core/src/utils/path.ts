import basepath from 'path';
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

Object.entries(basepath).forEach(([propName, propValue]) => {
  if (isFunction(propValue)) {
    // @ts-ignore
    path[propName] = ((propName) => {
      return (...args: any[]) => {
        args = args.map((p) => {
          if (isString(p)) {
            return toUnix(p);
          } else {
            return p;
          }
        });

        // @ts-ignore
        const result = basepath[propName](...args);
        if (isString(result)) {
          return toUnix(result);
        } else {
          return result;
        }
      };
    })(propName);
  } else {
    // @ts-ignore
    path[propName] = propValue;
  }
});

let { join, resolve, extname, dirname, basename, isAbsolute } = path;
export { join, resolve, extname, dirname, basename, isAbsolute };

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
