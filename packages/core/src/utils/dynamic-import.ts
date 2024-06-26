import { pathToFileURL } from 'url';
import { isModule, isObject, isString } from './assertion';
import { resolve } from './path';

export const dynamicImport = async <T>(
  toImport: T | string,
  from = process.cwd(),
  takeDefault = true,
): Promise<T> => {
  if (!toImport) {
    return toImport as T;
  }

  try {
    if (isString(toImport)) {
      const path = resolve(from, toImport);
      // use pathToFileURL to solve issue #1332.
      // https://github.com/nodejs/node/issues/31710
      const fileUrl = pathToFileURL(path);
      const data = await import(fileUrl.href);
      if (takeDefault && (isObject(data) || isModule(data)) && data.default) {
        return (data as any).default as T;
      }

      return data;
    }

    return Promise.resolve<T>(toImport);
  } catch (error) {
    throw `Oups... 🍻. Path: ${toImport} => ${error}`;
  }
};
