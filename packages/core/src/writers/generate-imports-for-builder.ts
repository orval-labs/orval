import { uniqueBy } from 'remeda';

import type { GeneratorImport, NormalizedOutputOptions } from '../types';
import { conventionName, upath } from '../utils';

export function generateImportsForBuilder(
  output: NormalizedOutputOptions,
  imports: GeneratorImport[],
  relativeSchemasPath: string,
) {
  return output.schemas && !output.indexFiles
    ? uniqueBy(imports, (x) => x.name).map((i) => {
        const name = conventionName(i.name, output.namingConvention);
        return {
          exports: [i],
          dependency: upath.joinSafe(relativeSchemasPath, name),
        };
      })
    : [{ exports: imports, dependency: relativeSchemasPath }];
}
