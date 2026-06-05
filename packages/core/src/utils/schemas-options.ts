import type { NormalizedSchemaOptions } from '../types';
import { isObject } from './assertion';

export interface SchemaOptionLike {
  importPath?: string;
}

/**
 * Extracts the custom package import specifier from a normalized `schemas`
 * config. Returns `undefined` when `schemas` is a plain string, `false`,
 * `undefined`, or when `importPath` is not set.
 */
export function getSchemasImportPath(
  schemas?: string | NormalizedSchemaOptions | SchemaOptionLike | false | null,
): string | undefined {
  if (isObject(schemas)) {
    return (schemas as SchemaOptionLike).importPath;
  }
  return undefined;
}
