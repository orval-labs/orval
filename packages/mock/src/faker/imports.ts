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

/**
 * Merge imports returned from mock resolution when the shared imports array
 * was not mutated in place. Enum mocks and nested object factories return
 * their imports separately; schema-factory delegation mutates `sharedImports`
 * directly and must not be merged again from `resolvedImports`.
 */
export function mergeReturnedMockImports(
  sharedImports: GeneratorImport[],
  sharedBefore: number,
  resolvedImports: GeneratorImport[],
): void {
  if (sharedImports.length === sharedBefore) {
    appendImportsDelta(sharedImports, resolvedImports, 0);
  }
}
