import uniqBy from 'lodash.uniqby';
import { GeneratorImport, NormalizedOutputOptions } from '../types';
import { upath, camel } from '../utils';

export const generateImportsForBuilder = (
  output: NormalizedOutputOptions,
  imports: GeneratorImport[],
  relativeSchemasPath: string,
) =>
  output.schemas && !output.indexFiles
    ? uniqBy(imports, 'name').map((i) => ({
        exports: [i],
        dependency: upath.joinSafe(relativeSchemasPath, camel(i.name)),
      }))
    : [{ exports: imports, dependency: relativeSchemasPath }];
