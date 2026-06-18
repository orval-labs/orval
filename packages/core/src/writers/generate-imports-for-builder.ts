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
      const dependency = upath.joinSafe(
        relativeSchemasPath,
        `${normalizedName}${suffix}${importExtension}`,
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

  const otherImports = uniqueBy(
    imports.filter(
      (i): i is GeneratorImport & { importPath: string } => !!i.importPath,
    ),
    (x) => x.name + x.importPath,
  ).map<GeneratorDependency>((i) => {
    return {
      exports: [i],
      dependency: i.importPath,
    };
  });

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
