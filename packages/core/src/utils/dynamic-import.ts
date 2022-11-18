import { resolve } from 'path';
import { isModule, isObject, isString } from './assertion';

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
      const data = await import(path);
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
