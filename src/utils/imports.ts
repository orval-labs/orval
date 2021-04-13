import { resolve } from 'upath';
import { isObject, isString } from './is';

export const dynamicImport = async <T>(
  toImport: T | string,
  from = process.cwd(),
): Promise<T> => {
  if (!toImport) {
    return toImport as T;
  }

  const path = resolve(from, toImport);

  try {
    if (isString(toImport)) {
      const data = await import(path);
      if (isObject(data) && data.default) {
        return (data as any).default as T;
      }

      return data;
    }

    return Promise.resolve<T>(toImport);
  } catch (error) {
    throw `Oups... 🍻. Path: ${path} => ${error}`;
  }
};
