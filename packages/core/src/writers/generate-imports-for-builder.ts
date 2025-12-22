import { uniqueBy } from 'remeda';

import type { GeneratorImport, NormalizedOutputOptions } from '../types';
import { conventionName, upath } from '../utils';

export function generateImportsForBuilder(
  output: NormalizedOutputOptions,
  imports: GeneratorImport[],
  relativeSchemasPath: string,
) {
  if (!output.indexFiles) {
    return uniqueBy(imports, (x) => x.name).map((i) => {
      const baseName = i.isZodSchema && i.schemaName ? i.schemaName : i.name;
      const name = conventionName(baseName, output.namingConvention);
      const suffix = i.isZodSchema ? '.zod' : '';
      return {
        exports: [i],
        dependency: upath.joinSafe(relativeSchemasPath, `${name}${suffix}`),
      };
    });
  } else {
    const typeScriptTypeImports = imports.filter((i) => !i.isZodSchema);
    const typeScriptTypeImportGroup =
      typeScriptTypeImports.length > 0
        ? [{ exports: typeScriptTypeImports, dependency: relativeSchemasPath }]
        : [];

    const zodSchemaImports = imports.filter((i) => i.isZodSchema);
    const zodSchemaImportGroup =
      zodSchemaImports.length > 0
        ? [
            {
              exports: zodSchemaImports,
              dependency: upath.joinSafe(relativeSchemasPath, 'index.zod'),
            },
          ]
        : [];

    return [...typeScriptTypeImportGroup, ...zodSchemaImportGroup];
  }
}
