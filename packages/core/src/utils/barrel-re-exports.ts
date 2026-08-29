import type { SharedExports } from '../types';
import { stripFileExtension } from './file';
import * as upath from './path';

export interface BarrelReExportFile {
  /** Path of the emitted file. */
  path: string;
  /** Declared by generators whose files repeat shared boilerplate. */
  sharedExports?: SharedExports;
}

export interface BarrelReExportOptions {
  /** Directory that holds the barrel. Files outside it are ignored. */
  dirname: string;
  /** Extension of the emitted files, for example `.ts` or `.generated.ts`. */
  extension: string;
  /** Extension to write in the module specifier. Usually empty. */
  importExtension: string;
}

/** How one file re-exports a shared name. */
type ExportKind = 'type' | 'value';

/** `mixed` when files disagree, which leaves the name with no owner. */
type Kind = ExportKind | 'mixed';

/**
 * Barrel lines that re-export a set of sibling files.
 *
 * @remarks
 * Wildcard-exporting two files that declare the same name makes it ambiguous
 * (TS2308). An explicit re-export shadows `export *`, so one file is picked to
 * own each repeated name.
 *
 * A name gets exactly one line. `export type { X } from './a'` beside
 * `export { X } from './b'` is TS2300, not a fix, because the `type` modifier
 * does not open a second slot — it only says how the owning file declares X.
 * `export { X }` carries the type meaning too, so a file declaring a name in
 * both categories owns it as a value.
 *
 * That leaves one case unowned: a name that is a type in one file and a value
 * in another, where either line would drop the other meaning. It stays
 * ambiguous, since a generator declaring one name as two things is a defect
 * worth failing on. So is a collision between two tags, which is why only
 * names a generator {@link SharedExports | declares} are considered.
 *
 * @param files - Sibling files, in barrel order.
 * @param alreadyExported - Names the barrel already has a line for, split by
 * category. Listed in either one, the name is taken.
 * @returns Barrel lines, named re-exports first. No trailing newlines.
 */
export function buildBarrelReExports(
  files: readonly BarrelReExportFile[],
  { dirname, extension, importExtension }: BarrelReExportOptions,
  alreadyExported: {
    readonly types?: readonly string[];
    readonly values?: readonly string[];
  } = {},
): string[] {
  const entries = files
    .map((file) => ({
      sharedExports: file.sharedExports,
      relativePath: upath.relativeSafe(dirname, file.path),
    }))
    .filter(({ relativePath }) => !relativePath.startsWith('..'))
    .toSorted((a, b) => a.relativePath.localeCompare(b.relativePath))
    .map(({ sharedExports, relativePath }) => ({
      sharedExports,
      specifier: stripFileExtension(relativePath, extension) + importExtension,
    }));

  // `export { X }` re-exports the type meaning too, so a file that declares a
  // name in both categories counts as declaring a value.
  const declaredNames = ({ types, values }: SharedExports) =>
    new Set([...types, ...values]);
  const declarationKind = (
    { values }: SharedExports,
    name: string,
  ): ExportKind => (values.includes(name) ? 'value' : 'type');

  const declarations = new Map<string, { count: number; kind: Kind }>();
  for (const { sharedExports } of entries) {
    if (!sharedExports) continue;
    for (const name of declaredNames(sharedExports)) {
      const kind = declarationKind(sharedExports, name);
      const seen = declarations.get(name);
      declarations.set(name, {
        count: (seen?.count ?? 0) + 1,
        kind: !seen || seen.kind === kind ? kind : 'mixed',
      });
    }
  }

  // One slot per name, so one `claimed` set across both categories. A name
  // preclaimed by the caller in either category is already on a line.
  const claimed = new Set([
    ...(alreadyExported.types ?? []),
    ...(alreadyExported.values ?? []),
  ]);

  const lines: string[] = [];
  for (const { specifier, sharedExports } of entries) {
    if (!sharedExports) continue;

    const owned: Record<ExportKind, string[]> = { type: [], value: [] };
    for (const name of declaredNames(sharedExports)) {
      const declaration = declarations.get(name);
      if (!declaration || claimed.has(name)) continue;
      // Declared once: the wildcard is unambiguous. Declared as two different
      // things: no single line can own it.
      if (declaration.count < 2 || declaration.kind === 'mixed') continue;
      claimed.add(name);
      owned[declaration.kind].push(name);
    }

    if (owned.type.length > 0) {
      lines.push(
        `export type { ${owned.type.toSorted().join(', ')} } from '${specifier}';`,
      );
    }
    if (owned.value.length > 0) {
      lines.push(
        `export { ${owned.value.toSorted().join(', ')} } from '${specifier}';`,
      );
    }
  }
  lines.push(
    ...entries.map(({ specifier }) => `export * from '${specifier}';`),
  );

  return lines;
}
