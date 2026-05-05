import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { createJiti } from 'jiti';

import { isModule, isObject, isString } from './assertion';

const TS_MODULE_EXTENSIONS = new Set(['.ts', '.mts', '.cts', '.tsx', '.jsx']);

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
      const extension = path.extname(filePath);

      if (TS_MODULE_EXTENSIONS.has(extension)) {
        const jiti = createJiti(from, {
          interopDefault: true,
        });
        const data = await jiti.import(filePath);

        if (takeDefault && (isObject(data) || isModule(data)) && data.default) {
          return data.default as T;
        }

        return data as T;
      }

      // use pathToFileURL to solve issue #1332.
      // https://github.com/nodejs/node/issues/31710
      const fileUrl = pathToFileURL(filePath);
      const isJson = extension === '.json';
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
      { cause: error },
    );
  }
}
