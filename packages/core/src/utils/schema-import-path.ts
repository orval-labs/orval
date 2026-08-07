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
  /** `true` when schemas are emitted as Zod schemas, not TypeScript types. */
  isZod: boolean;
  /**
   * Schema→tag map, set when `schemas.splitByTags` is enabled. The sentinel
   * `'.'` marks a shared schema, which stays at the schemas root.
   */
  schemaTagMap?: Map<string, string>;
}

/**
 * Resolves schema imports to the modules that export them.
 *
 * Shared by `generateImportsForBuilder` and by client generators that emit
 * sibling files, so both refer to the emitted schemas in the same way.
 * Callers shape their own exports (aliasing, `values`, default imports).
 *
 * @param output - Normalized output options.
 * @param imports - Schema imports to resolve. The caller must first remove
 *   imports that carry their own `importPath`.
 * @param relativeSchemasPath - Module that the schemas resolve from: a package
 *   specifier when `schemas.importPath` is set, or a relative path.
 * @returns One dependency per module, each with its imports.
 */
export function resolveSchemaImportDependencies(
  output: NormalizedOutputOptions,
  imports: readonly GeneratorImport[],
  relativeSchemasPath: string,
  { isZod, schemaTagMap }: ResolveSchemaImportDependenciesOptions,
): GeneratorDependency[] {
  // A root barrel makes every schema available from one module.
  if (output.indexFiles) {
    return [
      {
        exports: dedupeSchemaImports(imports),
        dependency: relativeSchemasPath,
      },
    ];
  }

  // Zod schema files are named with `schemaFileExtension` (`.zod.ts` by
  // default), TypeScript ones with `fileExtension`. Derive the import tail
  // from the same value, or the import names a file that is never emitted.
  const schemaFileExtension = isZod
    ? output.schemaFileExtension
    : output.fileExtension;

  // A package specifier resolves through the consumer's module resolution, so
  // drop the module extension. `@acme/models/pet.js` does not resolve. Passing
  // no tsconfig removes it without the NodeNext `.ts`→`.js` rewrite.
  const isPackageImport = !!getSchemasImportPath(output.schemas);
  const importExtension = isPackageImport
    ? getImportExtension(schemaFileExtension)
    : getImportExtension(schemaFileExtension, output.tsconfig);

  const importsByDependency = new Map<string, GeneratorImport[]>();

  for (const schemaImport of imports) {
    // Zod files are named from the TS identifier. TypeScript files prefer the
    // original spec name when it differs.
    const baseName = isZod
      ? schemaImport.name
      : (schemaImport.schemaName ?? schemaImport.name);
    const normalizedName = conventionName(baseName, output.namingConvention);

    // `buildSchemaTagMap` keys on the TS identifier, so look up
    // `schemaImport.name` and not `schemaName`.
    const tagDir = schemaTagMap?.get(schemaImport.name);
    const tagSegment = tagDir && tagDir !== '.' ? `${tagDir}/` : '';

    const dependency = upath.joinSafe(
      relativeSchemasPath,
      `${tagSegment}${normalizedName}${importExtension}`,
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
 * Collapses imports that emit the same import specifier. The key holds every
 * field that changes the specifier, so one name under two aliases stays twice.
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
