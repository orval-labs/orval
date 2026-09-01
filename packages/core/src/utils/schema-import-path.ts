import type {
  GeneratorDependency,
  GeneratorImport,
  NormalizedOutputOptions,
} from '../types';
import { conventionName } from './case';
import * as upath from './path';
import { getSchemasImportPath } from './schemas-options';
import { getImportExtension } from './tsconfig';
import type { SchemaOutputPlan } from '../writers/schema-output-plan';

/**
 * Tag directory for a schema that more than one tag uses. Such schemas stay at
 * the schemas root rather than being duplicated into each tag directory.
 */
export const SHARED_DIR = '.';

export interface ResolveSchemaImportDependenciesOptions {
  /** `true` when schemas are emitted as Zod schemas, not TypeScript types. */
  isZod: boolean;
  /**
   * Schema→tag map, set when `schemas.splitByTags` is enabled. The sentinel
   * `'.'` marks a shared schema, which stays at the schemas root.
   */
  schemaTagMap?: Map<string, string>;
  /**
   * Plan built from `schemas.routes`. When present it owns the file layout,
   * so it supersedes both the flat layout and `schemaTagMap` routing (#3942).
   */
  schemaOutputPlan?: SchemaOutputPlan;
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
  {
    isZod,
    schemaTagMap,
    schemaOutputPlan,
  }: ResolveSchemaImportDependenciesOptions,
): GeneratorDependency[] {
  // A routed plan may fold several spec names onto one emitted schema. Import
  // the canonical name, or the import names a binding the file never exports.
  const resolved = schemaOutputPlan
    ? imports.map((schemaImport) => {
        if (!schemaOutputPlan.hasSchema(schemaImport.name)) return schemaImport;
        const canonicalName = schemaOutputPlan.canonicalNameFor(
          schemaImport.name,
        );
        return canonicalName === schemaImport.name
          ? schemaImport
          : { ...schemaImport, name: canonicalName };
      })
    : imports;

  const schemasImportPath = getSchemasImportPath(output.schemas);
  const isPackageImport = !!schemasImportPath;

  // A root barrel makes every schema available from one module.
  if (output.indexFiles) {
    return [
      {
        exports: dedupeSchemaImports(resolved),
        dependency: schemasImportPath ?? relativeSchemasPath,
      },
    ];
  }

  // Zod schema files are named with `schemaFileExtension` (`.zod.ts` by
  // default), TypeScript ones with `fileExtension`. Derive the import tail
  // from the same value, or the import names a file that is never emitted.
  const schemaFileExtension = isZod
    ? output.schemaFileExtension
    : output.fileExtension;

  // A package subpath resolves through the consumer's export map, which knows
  // nothing of our tsconfig: `pet.zod.ts` is imported as
  // `@acme/models/pet.zod`. Withholding the tsconfig drops `.ts` without the
  // NodeNext `.ts`→`.js` rewrite, which would name a file nobody emits.
  const importExtension = getImportExtension(
    schemaFileExtension,
    isPackageImport ? undefined : output.tsconfig,
  );

  const importsByDependency = new Map<string, GeneratorImport[]>();

  for (const schemaImport of resolved) {
    // `<Name>Output` aliases are emitted into their base schema's file, so
    // they resolve through `zodBaseName` (#3927). Everything else is named
    // after the TS identifier: the schemas writer emits each file as
    // `schema.name` including the Response/Body/Parameter suffix, so
    // preferring `schemaName` (the bare ref) would point at a file that is
    // never written (#2912).
    const baseName = schemaImport.zodBaseName ?? schemaImport.name;
    const normalizedName = conventionName(baseName, output.namingConvention);

    const tagDir = schemaTagMap?.get(baseName);
    const tagSegment = tagDir && tagDir !== SHARED_DIR ? `${tagDir}/` : '';

    const flatDependency = upath.joinSafe(
      relativeSchemasPath,
      `${tagSegment}${normalizedName}${importExtension}`,
    );

    // The plan owns the layout when routes are configured. For a package
    // import it maps to an export subpath; a schema the plan does not place
    // falls back to the flat layout.
    const dependency = schemaOutputPlan
      ? isPackageImport
        ? (schemaOutputPlan.packageImportPath(schemaImport.name) ??
          flatDependency)
        : schemaOutputPlan.clientImportPath(
            schemaImport.name,
            relativeSchemasPath,
          )
      : flatDependency;

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
 * Collapses imports that name the same binding. The key holds every field that
 * changes the binding, so one schema under two aliases stays twice.
 *
 * `values` is merged, not keyed on: `generateImports` groups by it, so keeping
 * a type-only entry beside its value twin emits `import type { Pet }` and
 * `import { Pet }` from one module — TS2300. A value import serves the type
 * position too, so it wins for the whole binding.
 */
export function dedupeSchemaImports(
  imports: readonly GeneratorImport[],
): GeneratorImport[] {
  const byBinding = new Map<string, GeneratorImport>();

  for (const entry of imports) {
    const key = `${entry.name}|${entry.alias ?? ''}|${String(entry.default)}`;
    const existing = byBinding.get(key);
    if (!existing) {
      byBinding.set(key, entry);
    } else if (entry.values && !existing.values) {
      byBinding.set(key, { ...existing, values: true });
    }
  }

  return [...byBinding.values()];
}
