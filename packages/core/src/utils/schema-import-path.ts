import { uniqueBy } from 'remeda';

import type {
  GeneratorDependency,
  GeneratorImport,
  NormalizedOutputOptions,
} from '../types';
import { conventionName } from './case';
import * as upath from './path';
import { getSchemasImportPath } from './schemas-options';
import { getImportExtension } from './tsconfig';

export interface ResolveSchemaImportDependenciesOptions {
  /**
   * `true` when schemas are emitted as Zod schemas rather than TypeScript
   * types. Zod schemas live in `*.zod` files and are runtime values, so
   * callers that need value imports set `values` on the returned exports
   * themselves — this helper only resolves paths.
   */
  isZod: boolean;
  /**
   * Schema→tag map computed when `schemas.splitByTags` is enabled. Consulted
   * only in the `indexFiles: false` branch, where the root barrel does not
   * exist and each import must resolve to its actual file. `'.'` is the
   * sentinel for shared schemas (referenced by 0 or 2+ tags), which stay at
   * the schemas root.
   */
  schemaTagMap?: Map<string, string>;
}

/**
 * Resolves schema imports to the modules they should be imported from.
 *
 * This is the single source of truth for how generated code refers to emitted
 * schemas. It is shared between `generateImportsForBuilder` (which resolves
 * imports for the main generated files) and client generators that emit extra
 * sibling files — notably Angular's `*.resource.ts`. Those sibling files are
 * rendered before any mode writer runs, so they cannot observe the writers'
 * import decisions and must re-derive them from `output`; sharing this helper
 * is what keeps the two in agreement.
 *
 * Callers are responsible for their own export shaping (aliasing, `values`,
 * default imports).
 *
 * @param output - Normalized output options.
 * @param relativeSchemasPath - Module the schemas resolve from: a package
 *   specifier when `schemas.importPath` is set, otherwise a relative path.
 * @param imports - Schema imports to resolve. Imports carrying their own
 *   `importPath` must be filtered out by the caller.
 * @param options - Zod mode and the optional schema→tag map.
 * @returns One dependency per distinct module, each carrying its imports.
 */
export function resolveSchemaImportDependencies(
  output: NormalizedOutputOptions,
  relativeSchemasPath: string,
  imports: readonly GeneratorImport[],
  { isZod, schemaTagMap }: ResolveSchemaImportDependenciesOptions,
): GeneratorDependency[] {
  // With a root barrel, every schema is reachable from one module.
  if (output.indexFiles) {
    return [
      {
        exports: dedupeSchemaImports(imports),
        dependency: relativeSchemasPath,
      },
    ];
  }

  // A package specifier resolves through the consumer's module resolution, so
  // appending a local file extension would produce an unresolvable sub-path
  // (`@acme/models/pet.js`).
  const isPackageImport = !!getSchemasImportPath(output.schemas);
  const importExtension = isPackageImport
    ? ''
    : getImportExtension(output.fileExtension, output.tsconfig);
  const suffix = isZod ? '.zod' : '';

  const importsByDependency = new Map<string, GeneratorImport[]>();

  for (const schemaImport of imports) {
    // Zod schema files are named from the TS identifier; TypeScript schema
    // files prefer the original spec name when it differs.
    const baseName = isZod
      ? schemaImport.name
      : (schemaImport.schemaName ?? schemaImport.name);
    const normalizedName = conventionName(baseName, output.namingConvention);

    // The lookup uses the TS identifier (`schemaImport.name`), not
    // `schemaName`, because `buildSchemaTagMap` keys on `schema.name` which is
    // the pascal-cased identifier produced by `getRefInfo`. `baseName` is only
    // correct for the filename, where `conventionName` happens to be
    // idempotent on already-pascal-cased input.
    const tagDir = schemaTagMap?.get(schemaImport.name);
    const tagSegment = tagDir && tagDir !== '.' ? `${tagDir}/` : '';

    const dependency = upath.joinSafe(
      relativeSchemasPath,
      `${tagSegment}${normalizedName}${suffix}${importExtension}`,
    );

    const existing = importsByDependency.get(dependency);
    if (existing) {
      existing.push(schemaImport);
    } else {
      importsByDependency.set(dependency, [schemaImport]);
    }
  }

  return [...importsByDependency.entries()].map(
    ([dependency, dependencyImports]) => ({
      dependency,
      exports: dedupeSchemaImports(dependencyImports),
    }),
  );
}

/**
 * Collapses imports that would emit identical import specifiers. Keyed on
 * every field that affects the emitted specifier, so two imports of the same
 * name under different aliases both survive.
 *
 * Exported for callers that resolve a single dependency themselves — notably
 * when no schemas are emitted and the "schemas path" is one file rather than a
 * directory — so they dedupe by the same rule.
 */
export function dedupeSchemaImports(
  imports: readonly GeneratorImport[],
): GeneratorImport[] {
  return uniqueBy(
    imports,
    (entry) =>
      `${entry.name}|${entry.alias ?? ''}|${String(entry.values)}|${String(
        entry.default,
      )}`,
  );
}
