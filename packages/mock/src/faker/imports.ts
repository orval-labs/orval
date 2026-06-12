import type { GeneratorImport } from '@orval/core';

/**
 * Appends entries added to `source` since `sinceIndex`. Uses indexed push
 * instead of spread so large import batches (common with `schemas: true`
 * delegation on wide objects) do not overflow the call stack.
 */
export function appendImportsDelta(
  target: GeneratorImport[],
  source: GeneratorImport[],
  sinceIndex: number,
): void {
  for (let i = sinceIndex; i < source.length; i++) {
    target.push(source[i]!);
  }
}
