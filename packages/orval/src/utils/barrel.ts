import fs from 'fs-extra';

const RE_EXPORT_SPECIFIER = /export\s+\*\s+from\s*['"]([^'"]+)['"]/g;

/**
 * Extract the set of `export * from '...'` module specifiers from barrel
 * content. Quote-agnostic (matches both `'` and `"`) so it is unaffected by a
 * formatter changing quote style between generations.
 */
export function readReExportSpecifiers(content: string): Set<string> {
  return new Set([...content.matchAll(RE_EXPORT_SPECIFIER)].map((m) => m[1]));
}

/**
 * Return the deduplicated list of specifiers for a barrel by unioning the
 * freshly generated `specifiers` with whatever re-exports already exist on
 * disk. Merging on the bare specifier (rather than the formatted line) makes
 * the barrel idempotent across regenerations regardless of how an external
 * formatter rewrites quotes, semicolons, or whitespace. On-disk order is
 * preserved and new specifiers are appended — matching the previous append
 * ordering — so callers control any sorting they want.
 */
export async function mergeBarrelSpecifiers(
  filePath: string,
  specifiers: string[],
): Promise<string[]> {
  const existing = (await fs.pathExists(filePath))
    ? readReExportSpecifiers(await fs.readFile(filePath, 'utf8'))
    : new Set<string>();
  return [...new Set([...existing, ...specifiers])];
}
