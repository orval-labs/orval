import basepath from 'node:path';

import type {
  ClientMockBuilder,
  GlobalMockOptions,
  WriteModeProps,
} from '../types';
import { isFunction, upath } from '../utils';

export function getMockDir(
  entry: GlobalMockOptions | ClientMockBuilder,
  mockConfig: WriteModeProps['output']['mock'],
): string | undefined {
  if (!isFunction(entry) && entry.path) {
    return entry.path;
  }
  return mockConfig.path;
}

export function hasAnyMockPath(
  mockConfig: WriteModeProps['output']['mock'],
): boolean {
  if (mockConfig.path) return true;
  return mockConfig.generators.some((g) => !isFunction(g) && !!g.path);
}

export function resolveMockSchemasPath(
  mockFilePath: string,
  schemasTarget: string,
): string {
  // `upath.getRelativeImportPath` strips `basepath.extname`, which would
  // treat a trailing `.schemas` on `schemasTarget` (e.g. the implicit
  // `<filename>.schemas` path used when `output.schemas` is unset) as a
  // file extension and drop it. Treat `.schemas` as a logical marker
  // (not a real extension) and always end up with a real source-file
  // extension on the target.
  const ext = basepath.extname(mockFilePath);
  const targetExt = basepath.extname(schemasTarget);
  const targetWithExt =
    targetExt === '.schemas'
      ? schemasTarget + ext
      : targetExt
        ? schemasTarget
        : schemasTarget + ext;
  return upath.getRelativeImportPath(mockFilePath, targetWithExt);
}
