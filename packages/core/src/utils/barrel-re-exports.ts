import type { SharedExports } from '../types';

export interface BarrelReExportEntry {
  /** Module specifier as it should appear in the barrel. */
  specifier: string;
  /** Declared by generators whose files repeat shared boilerplate. */
  sharedExports?: SharedExports;
}

/**
 * Barrel lines re-exporting a set of sibling files.
 *
 * @remarks
 * Wildcard-exporting two files that both declare a name makes that name
 * ambiguous and TypeScript reports TS2308. An explicit re-export takes
 * precedence over `export *`, so every name declared by more than one entry is
 * re-exported by name from the first entry that declares it, ahead of the
 * wildcards.
 *
 * Ownership is per name rather than per file: a name shared by the second and
 * third entries but absent from the first is still resolved, so a generator
 * emitting some of its shared declarations conditionally stays correct.
 *
 * Only names a generator {@link SharedExports | declared} are considered.
 * Inferring them from emitted source would also swallow accidental collisions
 * between two tags, silently resolving them to one arbitrary file instead of
 * failing the build.
 *
 * @param entries - Sibling files in barrel order.
 * @param alreadyExported - Names the barrel re-exports by name already;
 * re-emitting one would be a duplicate declaration (TS2323).
 * @returns Barrel lines, named re-exports first. No trailing newlines.
 */
export function buildBarrelReExports(
  entries: readonly BarrelReExportEntry[],
  alreadyExported: readonly string[] = [],
): string[] {
  const excluded = new Set(alreadyExported);

  const declarationCounts = new Map<string, number>();
  for (const { sharedExports } of entries) {
    if (!sharedExports) continue;
    const declared = new Set([...sharedExports.types, ...sharedExports.values]);
    for (const name of declared) {
      declarationCounts.set(name, (declarationCounts.get(name) ?? 0) + 1);
    }
  }

  const owners = new Map<string, { types: string[]; values: string[] }>();
  const claimed = new Set<string>();

  const claim = (
    specifier: string,
    name: string,
    kind: 'types' | 'values',
  ): void => {
    if (
      claimed.has(name) ||
      excluded.has(name) ||
      (declarationCounts.get(name) ?? 0) < 2
    ) {
      return;
    }
    claimed.add(name);
    const owner = owners.get(specifier) ?? { types: [], values: [] };
    owner[kind].push(name);
    owners.set(specifier, owner);
  };

  for (const { specifier, sharedExports } of entries) {
    if (!sharedExports) continue;
    for (const name of sharedExports.types) claim(specifier, name, 'types');
    for (const name of sharedExports.values) claim(specifier, name, 'values');
  }

  const lines: string[] = [];
  for (const [specifier, { types, values }] of owners) {
    if (types.length > 0) {
      lines.push(
        `export type { ${types.toSorted().join(', ')} } from '${specifier}';`,
      );
    }
    if (values.length > 0) {
      lines.push(
        `export { ${values.toSorted().join(', ')} } from '${specifier}';`,
      );
    }
  }
  lines.push(
    ...entries.map(({ specifier }) => `export * from '${specifier}';`),
  );

  return lines;
}
