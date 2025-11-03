import { uniqueBy } from 'remeda';

import { OutputClient, type GeneratorImport, type NormalizedOutputOptions } from '../types';
import { conventionName, upath } from '../utils';

export const generateImportsForBuilder = (
  output: NormalizedOutputOptions,
  imports: GeneratorImport[],
  relativeSchemasPath: string,
) => {
  // For react-query-zod, don't generate imports from schemas as we use zod types instead
  if (output.client === OutputClient.REACT_QUERY_ZOD && output.schemas) {
    return [];
  }
  
  return output.schemas && !output.indexFiles
    ? uniqueBy(imports, (x) => x.name).map((i) => {
        const name = conventionName(i.name, output.namingConvention);
        return {
          exports: [i],
          dependency: upath.joinSafe(relativeSchemasPath, name),
        };
      })
    : [{ exports: imports, dependency: relativeSchemasPath }];
};
