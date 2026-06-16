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

/** Recover type imports referenced by nested oneOf split mock helpers. */
export function collectSplitMockTypeImports(
  implementations: readonly string[],
): GeneratorImport[] {
  const seen = new Set<string>();
  const imports: GeneratorImport[] = [];

  const addType = (name: string | undefined) => {
    if (!name || seen.has(name)) return;
    seen.add(name);
    imports.push({ name, values: false });
  };

  for (const impl of implementations) {
    for (const match of impl.matchAll(
      /export const get\w+Mock = \(\s*overrideResponse: Partial<(\w+)[^)]*\):\s*(\w+)\s*=>/g,
    )) {
      addType(match[1]);
      addType(match[2]);
    }

    for (const match of impl.matchAll(
      /export const get\w+Mock[\s\S]*?MockWithNullableOverrides<(?:Extract<(\w+),[^>]+>|(\w+)),/g,
    )) {
      addType(match[1] ?? match[2]);
    }
  }

  return imports;
}
