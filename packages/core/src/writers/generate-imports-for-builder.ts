import { uniqueBy } from 'remeda';

import type {
  GeneratorDependency,
  GeneratorImport,
  NormalizedOutputOptions,
} from '../types';
import { conventionName, getImportExtension, isObject, upath } from '../utils';

export function generateImportsForBuilder(
  output: NormalizedOutputOptions,
  imports: readonly GeneratorImport[],
  relativeSchemasPath: string,
): GeneratorDependency[] {
  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';

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
      const importExtension = getImportExtension(
        output.fileExtension,
        output.tsconfig,
      );
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

  return [...schemaImports, ...otherImports];
}
