import type { NormalizedOutputOptions } from '../types';
import { getRelativeImportPath } from './path';

/**
 * With `contentMapper.schemas`, the specifier that a file written at
 * `importerPath` imports the models from: the spec file, which the content
 * mapper serves as a module. The extension is kept, as it names the spec.
 */
export function getContentMapperSchemasImportPath(
  output: Pick<NormalizedOutputOptions, 'contentMapper'>,
  importerPath: string,
): string | undefined {
  return output.contentMapper?.schemas
    ? getRelativeImportPath(importerPath, output.contentMapper.specPath, true)
    : undefined;
}
