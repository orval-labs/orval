import { uniqueBy } from 'remeda';

import {
  type FakerMockOptions,
  type GeneratorDependency,
  type GeneratorImport,
  OutputMockType,
  type NormalizedMocksConfig,
  type NormalizedOutputOptions,
} from '../types';
import {
  conventionName,
  getImportExtension,
  isFunction,
  isObject,
  upath,
} from '../utils';

export function generateImportsForBuilder(
  output: NormalizedOutputOptions,
  imports: readonly GeneratorImport[],
  relativeSchemasPath: string,
  // Schema→tag map computed by `writeSpecs` when `schemas.splitByTags` is
  // enabled. Used only in the `indexFiles: false` branch to insert each
  // schema's tag subdirectory into the import path. `'.'` is the sentinel
  // for shared schemas (referenced by 0 or 2+ tags).
  schemaTagMap?: Map<string, string>,
): GeneratorDependency[] {
  const isPackageImport =
    isObject(output.schemas) && !!output.schemas.importPath;

  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';

  // Schema-factory imports (`getPetMock` and friends) always resolve to the
  // consolidated `<schemas-dir>/index.faker` file emitted by the faker
  // schemas option. They bypass the per-schema convention naming below.
  // Append `getImportExtension` so NodeNext / Node16 module resolution
  // gets the required local-file extension (e.g. `.js`).
  const schemaFactoryImports = imports.filter((i) => i.schemaFactory);
  const schemaFactoryImportExtension = isPackageImport
    ? ''
    : getImportExtension(output.fileExtension, output.tsconfig);

  // When the faker generator configures a dedicated `schemasImportPath`, use
  // it verbatim. This is needed because `schemas.importPath` is a package
  // barrel specifier (e.g. `@acme/models`) that may resolve to a single file
  // via tsconfig path mappings — appending `/index.faker` produces an
  // unresolvable sub-path in that case.
  const schemaFactoryDependency =
    getFakerSchemasImportPath(output.mock) ??
    upath.joinSafe(
      relativeSchemasPath,
      `index.faker${schemaFactoryImportExtension}`,
    );

  const schemaFactoryDeps: GeneratorDependency[] =
    schemaFactoryImports.length > 0
      ? [
          {
            exports: uniqueBy(
              schemaFactoryImports,
              (entry) => `${entry.name}|${entry.alias ?? ''}`,
            ),
            dependency: schemaFactoryDependency,
          },
        ]
      : [];

  // The rest of the schema-import bucket is for types emitted alongside
  // each schema (`Pet`, `PetWithTag`, ...). They're routed below.
  imports = imports.filter((i) => !i.schemaFactory);

  let schemaImports: GeneratorDependency[];
  if (output.indexFiles) {
    schemaImports = isZodSchemaOutput
      ? [
          {
            exports: imports.filter((i) => !i.importPath),
            dependency: relativeSchemasPath,
          },
        ]
      : [
          {
            exports: imports.filter((i) => !i.importPath),
            dependency: relativeSchemasPath,
          },
        ];
  } else {
    const importsByDependency = new Map<string, GeneratorImport[]>();

    for (const schemaImport of imports.filter((i) => !i.importPath)) {
      const baseName = isZodSchemaOutput
        ? schemaImport.name
        : (schemaImport.schemaName ?? schemaImport.name);
      const normalizedName = conventionName(baseName, output.namingConvention);
      const suffix = isZodSchemaOutput ? '.zod' : '';
      const importExtension = isPackageImport
        ? ''
        : getImportExtension(output.fileExtension, output.tsconfig);
      // When schemas are split by tag, route each import into its tag
      // subdirectory. Schemas referenced by 0 or 2+ tags land at the schemas
      // root (sentinel `'.'`); their path is unchanged from the flat layout.
      // The lookup uses the TS identifier (`schemaImport.name`), not
      // `schemaName`, because `buildSchemaTagMap` keys on `schema.name`
      // which is the pascal-cased TS identifier produced by `getRefInfo`.
      // `baseName` (which prefers `schemaName`) is only correct for the
      // filename computation below, where `conventionName` happens to be
      // idempotent on already-pascal-cased input.
      const tagDir = schemaTagMap?.get(schemaImport.name);
      const tagSegment = tagDir && tagDir !== '.' ? `${tagDir}/` : '';
      const dependency = upath.joinSafe(
        relativeSchemasPath,
        `${tagSegment}${normalizedName}${suffix}${importExtension}`,
      );

      if (!importsByDependency.has(dependency)) {
        importsByDependency.set(dependency, []);
      }
      importsByDependency.get(dependency)?.push(schemaImport);
    }

    schemaImports = [...importsByDependency.entries()].map(
      ([dependency, dependencyImports]) => ({
        dependency,
        exports: uniqueBy(
          dependencyImports,
          (entry) =>
            `${entry.name}|${entry.alias ?? ''}|${String(entry.values)}|${String(
              entry.default,
            )}`,
        ),
      }),
    );
  }

  const otherImportsMap = new Map<string, GeneratorImport[]>();
  for (const imp of uniqueBy(
    imports.filter(
      (i): i is GeneratorImport & { importPath: string } => !!i.importPath,
    ),
    (x) => x.name + x.importPath,
  )) {
    const existing = otherImportsMap.get(imp.importPath);
    if (existing) {
      existing.push(imp);
    } else {
      otherImportsMap.set(imp.importPath, [imp]);
    }
  }
  const otherImports = [...otherImportsMap.entries()].map<GeneratorDependency>(
    ([dependency, exports]) => ({
      exports,
      dependency,
    }),
  );

  return [...schemaImports, ...schemaFactoryDeps, ...otherImports];
}

/**
 * Extracts the faker generator's `schemasImportPath` from the normalized mock
 * config, if one is configured. Returns `undefined` when there is no faker
 * generator with schema factories enabled, or when `schemasImportPath` is not
 * set.
 */
function getFakerSchemasImportPath(
  mock: NormalizedMocksConfig | undefined,
): FakerMockOptions['schemasImportPath'] | undefined {
  if (!mock) {
    return undefined;
  }
  const faker = mock.generators.find(
    (g): g is FakerMockOptions =>
      !isFunction(g) && g.type === OutputMockType.FAKER && g.schemas === true,
  );
  return faker?.schemasImportPath;
}
