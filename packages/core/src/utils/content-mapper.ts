import path from 'node:path';

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

/** An output that the content mapper serves as its own module. */
export type ContentMapperOutputKind = 'schemas';

/**
 * The file name that `contentMapper.debugOutputPath` writes an output of the
 * spec at `specPath` to. Like the models of the split mode
 * (`<target>.schemas.ts`), it is the spec's name up to its first dot followed
 * by the kind, so `petstore.openapi.yaml` gives `petstore.schemas.ts`. The
 * content mapper always returns TypeScript, so the extension is `.ts`.
 */
export function getContentMapperDebugFileName(
  specPath: string,
  kind: ContentMapperOutputKind,
): string {
  const [name] = path.basename(specPath).split('.');
  return `${name}.${kind}.ts`;
}
