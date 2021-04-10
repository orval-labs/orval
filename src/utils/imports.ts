import { join } from 'upath';
import { isObject, isString } from './is';

export const dynamicImport = async <T>(
  toImport: T | string,
  from = process.cwd(),
): Promise<T> => {
  if (isString(toImport)) {
    const data = await import(join(from, toImport));

    if (isObject(data)) {
      return (data as any).default as T;
    }

    return data;
  }

  return Promise.resolve<T>(toImport);
};
