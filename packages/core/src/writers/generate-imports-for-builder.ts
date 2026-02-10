import { uniqueBy } from 'remeda';

import type { GeneratorImport, NormalizedOutputOptions } from '../types';
import { conventionName, isObject, upath } from '../utils';

export function generateImportsForBuilder(
  output: NormalizedOutputOptions,
  imports: GeneratorImport[],
  relativeSchemasPath: string,
) {
  const isZodSchemaOutput =
    isObject(output.schemas) && output.schemas.type === 'zod';

  if (output.indexFiles) {
    return isZodSchemaOutput
      ? [
          {
            exports: imports.map((i) => ({ ...i, values: true })),
            dependency: upath.joinSafe(relativeSchemasPath, 'index.zod'),
          },
        ]
      : [{ exports: imports, dependency: relativeSchemasPath }];
  } else {
    return uniqueBy(imports, (x) => x.name).map((i) => {
      const baseName = i.schemaName ?? i.name;
      const name = conventionName(baseName, output.namingConvention);
      const suffix = isZodSchemaOutput ? '.zod' : '';
      const importExtension = output.fileExtension.replace(/\.ts$/, '') || '';
      return {
        exports: isZodSchemaOutput ? [{ ...i, values: true }] : [i],
        dependency: upath.joinSafe(
          relativeSchemasPath,
          `${name}${suffix}${importExtension}`,
        ),
      };
    });
  }
}
