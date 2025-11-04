import { uniqueBy } from 'remeda';

import {
  ModelStyle,
  type GeneratorImport,
  type NormalizedOutputOptions,
} from '../types';
import { conventionName, upath } from '../utils';

export const generateImportsForBuilder = (
  output: NormalizedOutputOptions,
  imports: GeneratorImport[],
  relativeSchemasPath: string,
) => {
  // Separate Zod imports (with relative paths in specKey) from regular imports
  const zodImports: GeneratorImport[] = [];
  const regularImports: GeneratorImport[] = [];

  imports.forEach((imp) => {
    // Check if specKey is a relative path (starts with './' or '../') - this indicates a Zod file import
    if (
      imp.specKey &&
      (imp.specKey.startsWith('./') || imp.specKey.startsWith('../'))
    ) {
      zodImports.push(imp);
    } else {
      regularImports.push(imp);
    }
  });

  // For zod model style, only generate Zod imports, skip regular schema imports
  if (output.modelStyle === ModelStyle.ZOD) {
    // Group Zod imports by their specKey (path to zod file)
    const zodImportsByPath = zodImports.reduce<
      Record<string, GeneratorImport[]>
    >((acc, imp) => {
      const key = imp.specKey || '';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(imp);
      return acc;
    }, {});

    // Generate imports for each Zod file path
    const zodImportsResult = Object.entries(zodImportsByPath).map(
      ([path, exps]) => ({
        exports: exps,
        dependency: path, // Use the relative path directly
      }),
    );

    return zodImportsResult;
  }

  // Generate regular imports from schemas (for non-zod model style)
  const regularImportsResult =
    output.schemas && !output.indexFiles
      ? uniqueBy(regularImports, (x) => x.name).map((i) => {
          const name = conventionName(i.name, output.namingConvention);
          return {
            exports: [i],
            dependency: upath.joinSafe(relativeSchemasPath, name),
          };
        })
      : [{ exports: regularImports, dependency: relativeSchemasPath }];

  // Group Zod imports by their specKey (path to zod file)
  const zodImportsByPath = zodImports.reduce<Record<string, GeneratorImport[]>>(
    (acc, imp) => {
      const key = imp.specKey || '';
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(imp);
      return acc;
    },
    {},
  );

  // Generate imports for each Zod file path
  const zodImportsResult = Object.entries(zodImportsByPath).map(
    ([path, exps]) => ({
      exports: exps,
      dependency: path, // Use the relative path directly
    }),
  );

  return [...regularImportsResult, ...zodImportsResult];
};
