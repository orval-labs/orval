import path from 'node:path';

import { writeGeneratedFile } from '@orval/core';
import fs from 'fs-extra';

const RE_EXPORT_LINE = /^\s*export\s+\*\s+from\s*['"]([^'"]+)['"]\s*;?\s*$/;

/**
 * Strip the configured `fileExtension` from a relative import path, in one
 * piece, before appending the module-resolution import extension.
 *
 * @remarks
 * A multi-part `fileExtension` (e.g. `.generated.ts`) must be removed whole.
 * Stripping only the last dot-segment (`/\.[^./]+$/`) leaves `.generated`
 * behind, so a subsequent `+ importExtension` doubles the suffix, e.g.
 * `pets.generated.ts` becomes `pets.generated` then `pets.generated.generated`.
 * The fallback (strip just the last segment) only fires for a relative path
 * that doesn't end with the full configured extension.
 */
export function stripFileExtension(
  relativePath: string,
  fileExtension: string,
): string {
  return relativePath.endsWith(fileExtension)
    ? relativePath.slice(0, -fileExtension.length)
    : relativePath.replace(/\.[^/.]+$/, '');
}

export function readReExportSpecifiers(content: string): Set<string> {
  const specifiers = new Set<string>();
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(RE_EXPORT_LINE)?.[1];
    if (m) specifiers.add(m);
  }
  return specifiers;
}

// Bare specifiers (no leading `.`) are assumed resolvable; the workspace
// barrel only emits relative paths, so node_modules probing is out of scope.
export async function reExportSpecifierExists(
  indexFile: string,
  specifier: string,
  fileExtension: string,
  importExtension: string,
): Promise<boolean> {
  if (!specifier.startsWith('.')) return true;

  const resolved = path.resolve(path.dirname(indexFile), specifier);
  const candidates = new Set<string>([resolved]);
  if (importExtension && specifier.endsWith(importExtension)) {
    candidates.add(resolved.slice(0, -importExtension.length) + fileExtension);
  }
  candidates.add(`${resolved}${fileExtension}`);
  candidates.add(path.join(resolved, `index${fileExtension}`));

  for (const candidate of candidates) {
    if (await fs.pathExists(candidate)) return true;
  }
  return false;
}

// Workspace barrel: line-preserving, prune stale exports on disk state,
// conditional write (#3675, #3756, #3763).
export async function reconcileWorkspaceBarrel(
  filePath: string,
  specifiers: string[],
  fileExtension: string,
  importExtension: string,
): Promise<void> {
  let existingContent: string;
  try {
    existingContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    await writeGeneratedFile(
      filePath,
      specifiers.map((s) => `export * from '${s}';`).join('\n') + '\n',
    );
    return;
  }
  const declared = [...readReExportSpecifiers(existingContent)];
  const resolvable = await Promise.all(
    declared.map((s) =>
      reExportSpecifierExists(filePath, s, fileExtension, importExtension),
    ),
  );
  const desired = new Set<string>(specifiers);
  declared.forEach((s, i) => {
    if (resolvable[i]) desired.add(s);
  });

  const seen = new Set<string>();
  const eol = existingContent.includes('\r\n') ? '\r\n' : '\n';
  const retained: string[] = [];
  for (const line of existingContent.split(/\r?\n/)) {
    const m = line.match(RE_EXPORT_LINE)?.[1];
    if (!m) {
      retained.push(line);
    } else if (desired.has(m) && !seen.has(m)) {
      retained.push(line);
      seen.add(m);
      desired.delete(m);
    }
  }

  const retainedContent = retained.join(eol).trimEnd();
  const appended = [...desired].map((s) => `export * from '${s}';`).join(eol);
  const nextContent =
    [retainedContent, appended].filter(Boolean).join(eol) + eol;

  if (nextContent !== existingContent) {
    await writeGeneratedFile(filePath, nextContent);
  }
}

// Zod schemas barrel: header-prefixed, sorted. Skips write when content is
// unchanged so no-op regenerations don't churn mtime (#3756).
export async function reconcileZodBarrel(
  filePath: string,
  specifiers: string[],
  header: string,
  mergeExisting: boolean,
): Promise<void> {
  let existingContent = '';
  try {
    existingContent = await fs.readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
  const existing = mergeExisting
    ? readReExportSpecifiers(existingContent)
    : new Set<string>();
  const body = [...new Set([...existing, ...specifiers])]
    .sort()
    .map((s) => `export * from '${s}';`)
    .join('\n');
  const nextContent = `${header}\n${body}\n`;
  if (nextContent !== existingContent) {
    await writeGeneratedFile(filePath, nextContent);
  }
}
