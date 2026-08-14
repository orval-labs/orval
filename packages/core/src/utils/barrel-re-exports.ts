import type { SharedExports } from '../types';
import { pathWithoutExtension } from './file';
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

/**
 * Barrel lines that re-export a set of sibling files.
 *
 * @remarks
 * Two files that both declare a name make that name ambiguous when the barrel
 * wildcard-exports both. TypeScript reports TS2308. An explicit re-export
 * shadows `export *`, so each name that more than one file declares is also
 * re-exported by name from the first file that declares it. Textual order does
 * not matter to TypeScript. The lines are ordered only to keep the output
 * stable.
 *
 * Only the names that a generator {@link SharedExports | declares} count. An
 * accidental collision between two tags stays a build error.
 *
 * @param files - Sibling files, in barrel order.
 * @param alreadyExported - Names that the barrel re-exports by name already,
 * split by {@link SharedExports} category. A second line for one of them is a
 * duplicate declaration (TS2323). A name preclaimed as a type does not
 * preclaim it as a value, and vice versa — the two live in the same
 * identifier namespace, but a common name that is a type in one file and a
 * value in another still needs one explicit line per category.
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
      // Strip the full `extension` when present. A multi-part extension
      // (`.generated.ts`) then goes in one piece and leaves no `.generated`
      // behind.
      specifier:
        (relativePath.endsWith(extension)
          ? relativePath.slice(0, -extension.length)
          : pathWithoutExtension(relativePath)) + importExtension,
    }));

  const declarationCounts = new Map<string, number>();
  for (const { sharedExports } of entries) {
    if (!sharedExports) continue;
    for (const name of new Set([
      ...sharedExports.types,
      ...sharedExports.values,
    ])) {
      declarationCounts.set(name, (declarationCounts.get(name) ?? 0) + 1);
    }
  }

  // Kept separate per {@link SharedExports} category: a name can be a type in
  // one file and a value in another (or both, in the same or different
  // files). Claiming it in one category must not suppress the explicit
  // re-export the other category still needs — a value re-export left to
  // `export *` while its type sibling was already claimed is just as
  // ambiguous (TS2308) as if neither had been claimed.
  const claimedTypes = new Set(alreadyExported.types);
  const claimedValues = new Set(alreadyExported.values);
  const claim = (
    names: readonly string[],
    claimed: Set<string>,
  ): string[] => {
    const owned = names.filter(
      (name) => !claimed.has(name) && (declarationCounts.get(name) ?? 0) > 1,
    );
    for (const name of owned) claimed.add(name);
    return owned.toSorted();
  };

  const lines: string[] = [];
  for (const { specifier, sharedExports } of entries) {
    if (!sharedExports) continue;
    const types = claim(sharedExports.types, claimedTypes);
    const values = claim(sharedExports.values, claimedValues);
    if (types.length > 0) {
      lines.push(`export type { ${types.join(', ')} } from '${specifier}';`);
    }
    if (values.length > 0) {
      lines.push(`export { ${values.join(', ')} } from '${specifier}';`);
    }
  }
  lines.push(
    ...entries.map(({ specifier }) => `export * from '${specifier}';`),
  );

  return lines;
}
