import { uniqueBy } from 'remeda';

import type {
  GeneratorDependency,
  GeneratorImport,
  NormalizedOutputOptions,
} from '../types';
import { conventionName, isObject, upath } from '../utils';

export function generateImportsForBuilder(
  output: NormalizedOutputOptions,
  imports: readonly GeneratorImport[],
  relativeSchemasPath: string,
): GeneratorDependency[] {
  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';

  let schemaImports: GeneratorDependency[] = [];
  if (output.indexFiles) {
    schemaImports = isZodSchemaOutput
      ? [
          {
            exports: imports.filter((i) => !i.importPath),
            dependency: upath.joinSafe(relativeSchemasPath, 'index.zod'),
          },
        ]
      : [
          {
            exports: imports.filter((i) => !i.importPath),
            dependency: relativeSchemasPath,
          },
        ];
  } else {
    schemaImports = uniqueBy(
      imports.filter((i) => !i.importPath),
      (x) => x.name,
    ).map((i) => {
      const baseName = i.schemaName ?? i.name;
      const name = conventionName(baseName, output.namingConvention);
      const suffix = isZodSchemaOutput ? '.zod' : '';
      const importExtension = output.fileExtension.replace(/\.ts$/, '') || '';
      return {
        exports: [i],
        dependency: upath.joinSafe(
          relativeSchemasPath,
          `${name}${suffix}${importExtension}`,
        ),
      };
    });
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
