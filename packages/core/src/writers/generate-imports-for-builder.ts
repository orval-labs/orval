import { uniqueBy } from 'remeda';

import type { GeneratorImport, NormalizedOutputOptions } from '../types.ts';
import { conventionName, isObject, upath } from '../utils/index.ts';

export function generateImportsForBuilder(
  output: NormalizedOutputOptions,
  imports: readonly GeneratorImport[],
  relativeSchemasPath: string,
) {
  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';

  let schemaImports: {
    exports: readonly GeneratorImport[];
    dependency: string;
  }[] = [];
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
    imports.filter((i) => !!i.importPath),
    (x) => x.name + (x.importPath ?? ''),
  ).map((i) => {
    return {
      exports: [i],
      dependency: i.importPath,
    };
  });

  return [...schemaImports, ...otherImports];
}
