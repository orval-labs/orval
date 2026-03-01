import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { isModule, isObject, isString } from './assertion.ts';

export async function dynamicImport<T>(
  toImport: T | string,
  from = process.cwd(),
  takeDefault = true,
): Promise<T> {
  if (!toImport) {
    return toImport as T;
  }

  try {
    if (isString(toImport)) {
      const filePath = path.resolve(from, toImport);
      // use pathToFileURL to solve issue #1332.
      // https://github.com/nodejs/node/issues/31710
      const fileUrl = pathToFileURL(filePath);
      const isJson = path.extname(fileUrl.href) === '.json';
      const data = (
        isJson
          ? await import(fileUrl.href, { with: { type: 'json' } })
          : await import(fileUrl.href)
      ) as Record<string, unknown>;
      if (takeDefault && (isObject(data) || isModule(data)) && data.default) {
        return data.default as T;
      }

      return data as unknown as T;
    }

    return toImport as T;
  } catch (error) {
    throw new Error(
      `Oups... 🍻. Path: ${String(toImport)} => ${String(error)}`,
    );
  }
}
