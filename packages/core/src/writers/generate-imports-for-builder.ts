import {
  type FakerMockOptions,
  type GeneratorDependency,
  type GeneratorImport,
  OutputMockType,
  type NormalizedMocksConfig,
  type NormalizedOutputOptions,
} from '../types';
import { uniqueBy } from '../utils';
import {
  getImportExtension,
  getSchemasImportPath,
  isFunction,
  isObject,
  resolveSchemaImportDependencies,
  upath,
} from '../utils';
import type { SchemaOutputPlan } from './schema-output-plan';

/** Builds client dependencies using tag routing or the planned schema paths. */
export function generateImportsForBuilder(
  output: NormalizedOutputOptions,
  imports: readonly GeneratorImport[],
  relativeSchemasPath: string,
  // Schema→tag map computed by `getApiBuilder` when `schemas.splitByTags` is
  // enabled. Used only in the `indexFiles: false` branch to insert each
  // schema's tag subdirectory into the import path. `'.'` is the sentinel
  // for shared schemas (referenced by 0 or 2+ tags).
  schemaTagMap?: Map<string, string>,
  schemaOutputPlan?: SchemaOutputPlan,
  // Path of the file being written. Needed to reach the schema factories when
  // the faker generator's `schemasPath` moves them out of the schemas dir.
  filePath?: string,
): GeneratorDependency[] {
  const isPackageImport = !!getSchemasImportPath(output.schemas);

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
  const schemaFactories = getSchemaFactoriesEntry(output.mock);
  const fakerSchemasPath = schemaFactories?.schemasPath;
  const schemaFactoryDependency =
    schemaFactories?.schemasImportPath ??
    (fakerSchemasPath && filePath
      ? upath.getRelativeImportPath(
          filePath,
          upath.join(fakerSchemasPath, 'index.faker.ts'),
        ) + getImportExtension(output.fileExtension, output.tsconfig)
      : upath.joinSafe(
          relativeSchemasPath,
          `index.faker${schemaFactoryImportExtension}`,
        ));

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

  const schemaImports = resolveSchemaImportDependencies(
    output,
    imports.filter((i) => !i.importPath),
    relativeSchemasPath,
    { isZod: isZodSchemaOutput, schemaTagMap, schemaOutputPlan },
  );

  // Operations contribute these independently, so the same binding can
  // arrive once as a type and once as a value (e.g. `HttpHeaders` from an
  // operation that only types it and one that narrows with `instanceof`).
  // A single file needs one import per binding, and a value import satisfies
  // both uses, so the value flag wins.
  const otherImportsMap = new Map<string, Map<string, GeneratorImport>>();
  for (const imp of imports.filter(
    (i): i is GeneratorImport & { importPath: string } => !!i.importPath,
  )) {
    const byBinding =
      otherImportsMap.get(imp.importPath) ?? new Map<string, GeneratorImport>();
    otherImportsMap.set(imp.importPath, byBinding);
    const key = `${imp.name}|${imp.alias ?? ''}`;
    const existing = byBinding.get(key);
    if (!existing) {
      byBinding.set(key, imp);
    } else if (imp.values && !existing.values) {
      byBinding.set(key, { ...existing, values: true });
    }
  }
  const otherImports = [...otherImportsMap.entries()].map<GeneratorDependency>(
    ([dependency, byBinding]) => ({
      exports: [...byBinding.values()],
      dependency,
    }),
  );

  return [...schemaImports, ...schemaFactoryDeps, ...otherImports];
}

/** The faker generator entry that emits schema factories (`schemas: true`). */
function getSchemaFactoriesEntry(
  mock: NormalizedMocksConfig | undefined,
): FakerMockOptions | undefined {
  return mock?.generators.find(
    (g): g is FakerMockOptions =>
      !isFunction(g) && g.type === OutputMockType.FAKER && g.schemas === true,
  );
}
