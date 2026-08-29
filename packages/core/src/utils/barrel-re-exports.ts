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
 * An export name is a single slot, whatever the `type` modifier says: emitting
 * both `export type { X } from './a'` and `export { X } from './b'` is
 * TS2300, not a resolution. So a name is claimed once, by one file, and the
 * `type` modifier only records how that file declares it. `export { X }`
 * carries the type meaning along with the value, so a file that declares a
 * name in both categories claims it as a value.
 *
 * A name that is a type in one file and a value in another cannot be resolved
 * this way — one line would drop the other meaning. It is left to the
 * wildcards, where it stays TS2308, because a generator declaring one name as
 * two different things is a defect that must not be papered over.
 *
 * Only the names that a generator {@link SharedExports | declares} count. An
 * accidental collision between two tags stays a build error.
 *
 * @param files - Sibling files, in barrel order.
 * @param alreadyExported - Names that the barrel re-exports by name already,
 * split by {@link SharedExports} category. A second line for one of them is a
 * duplicate declaration (TS2323), so a name listed in either category is
 * claimed and no further line is emitted for it.
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
  // name in both categories is recorded once, as a value.
  const declarationKind = (
    { values }: SharedExports,
    name: string,
  ): ExportKind => (values.includes(name) ? 'value' : 'type');

  const declarations = new Map<string, ExportKind[]>();
  for (const { sharedExports } of entries) {
    if (!sharedExports) continue;
    for (const name of new Set([
      ...sharedExports.types,
      ...sharedExports.values,
    ])) {
      const kinds = declarations.get(name) ?? [];
      kinds.push(declarationKind(sharedExports, name));
      declarations.set(name, kinds);
    }
  }

  // One slot per name, so one `claimed` set across both categories. A name
  // preclaimed by the caller in either category is already on a line.
  const claimed = new Set([
    ...(alreadyExported.types ?? []),
    ...(alreadyExported.values ?? []),
  ]);

  const claim = (
    sharedExports: SharedExports,
  ): Record<ExportKind, string[]> => {
    const owned: Record<ExportKind, string[]> = { type: [], value: [] };
    const names = new Set([...sharedExports.types, ...sharedExports.values]);
    for (const name of names) {
      const kinds = declarations.get(name) ?? [];
      // Declared once: the wildcard is unambiguous already.
      if (kinds.length < 2) continue;
      if (claimed.has(name)) continue;
      // A name declared as two different things has no single owner.
      if (kinds.some((kind) => kind !== kinds[0])) continue;
      claimed.add(name);
      owned[declarationKind(sharedExports, name)].push(name);
    }
    return { type: owned.type.toSorted(), value: owned.value.toSorted() };
  };

  const lines: string[] = [];
  for (const { specifier, sharedExports } of entries) {
    if (!sharedExports) continue;
    const { type: types, value: values } = claim(sharedExports);
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
